import "server-only";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { randomBytes } from "node:crypto";
import sql from "mssql";
import { isConnectorProvider, isNeonProvider } from "@/lib/data/factory";
import { isSqliteProvider } from "@/lib/data/config";
import { prisma } from "@/lib/prisma";
import { neonQuery } from "@/lib/neon/pool";

function loadEnvFile(filePath: string) {
  if (!existsSync(filePath)) return;
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}

loadEnvFile(resolve(process.cwd(), "connector/.env"));
loadEnvFile(resolve(process.cwd(), ".env"));

let mssqlPool: sql.ConnectionPool | null = null;

/** Recruiting su SQL Server (connector) o Postgres (neon). */
export function recruitingUsesSql() {
  return isConnectorProvider() || isNeonProvider();
}

export function newRecruitingId() {
  return `c${randomBytes(12).toString("hex")}`;
}

/** Converte T-SQL recruiting (dbo/@param/TOP) in Postgres Neon. */
function tsqlRecruitingToPg(
  tsql: string,
  inputs: Record<string, unknown>
): { text: string; values: unknown[] } {
  let text = tsql;
  const values: unknown[] = [];
  const names = Object.keys(inputs);

  // Parametri prima (servono per TOP (@take))
  const paramIndex = new Map<string, number>();
  for (const name of names) {
    values.push(inputs[name]);
    paramIndex.set(name, values.length);
  }
  const p = (name: string) => `$${paramIndex.get(name)}`;

  // TOP (@param) / TOP (n) / TOP n → LIMIT in coda
  let limitSuffix = "";
  const topParam = text.match(/SELECT\s+TOP\s*\(\s*@(\w+)\s*\)\s+/i);
  const topNumParen = text.match(/SELECT\s+TOP\s*\(\s*(\d+)\s*\)\s+/i);
  const topNum = text.match(/SELECT\s+TOP\s+(\d+)\s+/i);
  if (topParam) {
    limitSuffix = ` LIMIT ${p(topParam[1])}`;
    text = text.replace(/SELECT\s+TOP\s*\(\s*@\w+\s*\)\s+/i, "SELECT ");
  } else if (topNumParen) {
    limitSuffix = ` LIMIT ${topNumParen[1]}`;
    text = text.replace(/SELECT\s+TOP\s*\(\s*\d+\s*\)\s+/i, "SELECT ");
  } else if (topNum) {
    limitSuffix = ` LIMIT ${topNum[1]}`;
    text = text.replace(/SELECT\s+TOP\s+\d+\s+/i, "SELECT ");
  }

  text = text.replace(/\bdbo\./gi, "");
  text = text.replace(/\[([^\]]+)\]/g, '"$1"');
  text = text.replace(/CONVERT\s*\(\s*NVARCHAR\s*\(\s*\d+\s*\)\s*,\s*([^)]+)\)/gi, "($1)::text");
  text = text.replace(/GETUTCDATE\(\)/gi, "(NOW() AT TIME ZONE 'utc')");
  text = text.replace(/SYSUTCDATETIME\(\)/gi, "(NOW() AT TIME ZONE 'utc')");

  // Quote tabelle recruiting/core note
  text = text.replace(
    /\b(OfferteLavoro|RecruitingCandidature|RecruitingAttivita|RecruitingColloqui|RecruitingReceiverConfig|Users|Tenants)\b/g,
    '"$1"'
  );
  // Quote colonne PascalCase (anche dopo alias.)
  text = text.replace(
    /\.([A-Z][A-Za-z0-9]*)\b/g,
    '."$1"'
  );
  text = text.replace(
    /(?<![."\w])(Id|TenantId|Titolo|Luogo|ModalitaLavoro|TipoContratto|Orario|NumeroPosizioni|Descrizione|AttivitaPrincipali|Requisiti|Competenze|Retribuzione|Benefit|Paese|Stato|IndeedJobId|CreatedAt|UpdatedAt|OffertaId|ExternalApplicationId|ReceiverCandidateId|Source|ReceivedAt|LastSyncAt|Cognome|Nome|Email|EmailVerified|Phone|CoverLetter|CandidaturaId|Tipo|OccurredAt|Note|Esito|StatoDa|StatoA|ColloquioId|Canale|CreatedById|Round|ScheduledAt|Modalita|IntervistatoreUserId|IntervistatoreLabel|NotePreliminari|NoteSvolgimento|Valutazione|ValutazioneStelle|BaseUrl|Status|SourceName|PasswordHash|Role|Active|Name|OffertaTitolo|IntervistatoreName|IntervistatoreCognome)\b/g,
    '"$1"'
  );

  // MSSQL bit (0/1) → Postgres boolean (Active, EmailVerified, …)
  text = text.replace(/"(Active|EmailVerified)"\s*=\s*1\b/gi, '"$1" = true');
  text = text.replace(/"(Active|EmailVerified)"\s*=\s*0\b/gi, '"$1" = false');

  for (const name of names) {
    text = text.replace(new RegExp(`@${name}\\b`, "g"), p(name));
  }

  if (limitSuffix && !/\bLIMIT\b/i.test(text)) {
    const parts = text.split(";").map((s) => s.trim()).filter(Boolean);
    if (parts.length <= 1) {
      text = (parts[0] || text.trim()) + limitSuffix;
    } else {
      parts[0] = parts[0] + limitSuffix;
      text = parts.join(";\n");
    }
  }

  return { text, values };
}

type RecruitingQueryResult = { recordset: Record<string, unknown>[] };

class NeonRecruitingRequest {
  private inputs: Record<string, unknown> = {};

  input(name: string, _type: unknown, value: unknown) {
    this.inputs[name] = value;
    return this;
  }

  async query(tsql: string): Promise<RecruitingQueryResult> {
    const statements = tsql
      .split(/^\s*GO\s*$/gim)
      .flatMap((batch) => batch.split(";"))
      .map((s) => s.trim())
      .filter(Boolean);

    let last: Record<string, unknown>[] = [];
    for (const stmt of statements) {
      // Schema probes MSSQL-only
      if (/COL_LENGTH\s*\(/i.test(stmt)) {
        last = [{ Ok: 1 }];
        continue;
      }
      const { text, values } = tsqlRecruitingToPg(stmt, this.inputs);
      last = (await neonQuery(text, values)) as Record<string, unknown>[];
    }
    return { recordset: last };
  }
}

const neonPoolShim = {
  get connected() {
    return true;
  },
  request() {
    return new NeonRecruitingRequest();
  },
};

export async function recruitingPool(): Promise<
  sql.ConnectionPool | typeof neonPoolShim
> {
  if (isNeonProvider()) return neonPoolShim;
  if (mssqlPool?.connected) return mssqlPool;
  mssqlPool = await sql.connect({
    server: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 1433),
    database: process.env.DB_NAME || "CredixaDev",
    user: process.env.DB_USER || "credixa_dev",
    password: process.env.DB_PASSWORD || "",
    options: { encrypt: false, trustServerCertificate: true },
  });
  return mssqlPool;
}

export { sql };

let candidatoAnagraficaCols: boolean | null = null;
let candidatoIndeedApplyCols: boolean | null = null;

/** True se le colonne Cognome/Nome esistono (migration 033 / SQLite locale). */
export async function recruitingHasCandidatoAnagrafica(): Promise<boolean> {
  if (candidatoAnagraficaCols != null) return candidatoAnagraficaCols;
  if (isNeonProvider()) {
    candidatoAnagraficaCols = true;
    return true;
  }
  if (!recruitingUsesSql()) {
    if (!isSqliteProvider()) {
      candidatoAnagraficaCols = true;
      return true;
    }
    try {
      const rows = await prisma.$transaction((tx) =>
        tx.$queryRaw<Array<{ name: string }>>`
          PRAGMA table_info("RecruitingCandidatura")
        `
      );
      const names = new Set(rows.map((r) => String(r.name || "").toLowerCase()));
      candidatoAnagraficaCols = names.has("cognome") && names.has("nome");
    } catch {
      candidatoAnagraficaCols = false;
    }
    return candidatoAnagraficaCols;
  }
  const pool = await recruitingPool();
  const res = await pool.request().query(`
    SELECT CASE
      WHEN COL_LENGTH('dbo.RecruitingCandidature', 'Cognome') IS NULL THEN 0
      WHEN COL_LENGTH('dbo.RecruitingCandidature', 'Nome') IS NULL THEN 0
      ELSE 1
    END AS Ok
  `);
  const ok = Number(res.recordset[0]?.Ok) === 1;
  if (ok) candidatoAnagraficaCols = true;
  return ok;
}

/** True se Email/Phone/CoverLetter esistono (migration 034). */
export async function recruitingHasCandidatoIndeedApplyFields(): Promise<boolean> {
  if (candidatoIndeedApplyCols != null) return candidatoIndeedApplyCols;
  if (isNeonProvider()) {
    candidatoIndeedApplyCols = true;
    return true;
  }
  if (!recruitingUsesSql()) {
    if (!isSqliteProvider()) {
      candidatoIndeedApplyCols = true;
      return true;
    }
    try {
      const rows = await prisma.$transaction((tx) =>
        tx.$queryRaw<Array<{ name: string }>>`
          PRAGMA table_info("RecruitingCandidatura")
        `
      );
      const names = new Set(rows.map((r) => String(r.name || "").toLowerCase()));
      candidatoIndeedApplyCols =
        names.has("email") &&
        names.has("emailverified") &&
        names.has("phone") &&
        names.has("coverletter");
    } catch {
      candidatoIndeedApplyCols = false;
    }
    return candidatoIndeedApplyCols;
  }
  const pool = await recruitingPool();
  const res = await pool.request().query(`
    SELECT CASE
      WHEN COL_LENGTH('dbo.RecruitingCandidature', 'Email') IS NULL THEN 0
      WHEN COL_LENGTH('dbo.RecruitingCandidature', 'EmailVerified') IS NULL THEN 0
      WHEN COL_LENGTH('dbo.RecruitingCandidature', 'Phone') IS NULL THEN 0
      WHEN COL_LENGTH('dbo.RecruitingCandidature', 'CoverLetter') IS NULL THEN 0
      ELSE 1
    END AS Ok
  `);
  const ok = Number(res.recordset[0]?.Ok) === 1;
  if (ok) candidatoIndeedApplyCols = true;
  return ok;
}

export async function candidaturaSelectSql(alias?: string): Promise<string> {
  const p = alias ? `${alias}.` : "";
  const cols = [
    "Id",
    "TenantId",
    "OffertaId",
    "ExternalApplicationId",
    "ReceiverCandidateId",
    "Stato",
    "Source",
    "ReceivedAt",
    "UpdatedAt",
    "LastSyncAt",
  ];
  if (await recruitingHasCandidatoAnagrafica()) cols.push("Cognome", "Nome");
  if (await recruitingHasCandidatoIndeedApplyFields()) {
    cols.push("Email", "EmailVerified", "Phone", "CoverLetter");
  }
  return cols.map((c) => `${p}${c}`).join(", ");
}

export function mapOffertaRow(r: Record<string, unknown>) {
  return {
    id: String(r.Id),
    tenantId: String(r.TenantId),
    titolo: String(r.Titolo ?? ""),
    luogo: String(r.Luogo ?? ""),
    modalitaLavoro: String(r.ModalitaLavoro ?? "PRESENZA"),
    tipoContratto: String(r.TipoContratto ?? ""),
    orario: String(r.Orario ?? ""),
    numeroPosizioni: Number(r.NumeroPosizioni ?? 1),
    descrizione: String(r.Descrizione ?? ""),
    attivitaPrincipali: String(r.AttivitaPrincipali ?? ""),
    requisiti: String(r.Requisiti ?? ""),
    competenze: String(r.Competenze ?? ""),
    retribuzione: String(r.Retribuzione ?? ""),
    benefit: String(r.Benefit ?? ""),
    paese: String(r.Paese ?? "IT"),
    stato: String(r.Stato ?? "BOZZA"),
    indeedJobId: r.IndeedJobId != null ? String(r.IndeedJobId) : null,
    createdAt: new Date(String(r.CreatedAt)),
    updatedAt: new Date(String(r.UpdatedAt)),
  };
}

export function mapCandidaturaRow(r: Record<string, unknown>) {
  const emailVerifiedRaw = r.EmailVerified;
  let emailVerified: boolean | null = null;
  if (emailVerifiedRaw === true || emailVerifiedRaw === false) {
    emailVerified = emailVerifiedRaw;
  } else if (emailVerifiedRaw === 1 || emailVerifiedRaw === "1" || emailVerifiedRaw === "true") {
    emailVerified = true;
  } else if (emailVerifiedRaw === 0 || emailVerifiedRaw === "0" || emailVerifiedRaw === "false") {
    emailVerified = false;
  }
  return {
    id: String(r.Id),
    tenantId: String(r.TenantId),
    offertaId: String(r.OffertaId),
    externalApplicationId: r.ExternalApplicationId != null ? String(r.ExternalApplicationId) : null,
    receiverCandidateId: r.ReceiverCandidateId != null ? String(r.ReceiverCandidateId) : null,
    cognome: r.Cognome != null ? String(r.Cognome) : "",
    nome: r.Nome != null ? String(r.Nome) : "",
    email: r.Email != null ? String(r.Email) : null,
    emailVerified,
    phone: r.Phone != null ? String(r.Phone) : null,
    coverLetter: r.CoverLetter != null ? String(r.CoverLetter) : null,
    stato: String(r.Stato),
    source: r.Source != null ? String(r.Source) : null,
    receivedAt: new Date(String(r.ReceivedAt)),
    updatedAt: new Date(String(r.UpdatedAt)),
    lastSyncAt: r.LastSyncAt != null ? new Date(String(r.LastSyncAt)) : null,
  };
}

export function mapAttivitaRow(r: Record<string, unknown>) {
  const name = [r.CreatedByName, r.CreatedByCognome].filter(Boolean).join(" ").trim();
  return {
    id: String(r.Id),
    tenantId: String(r.TenantId),
    candidaturaId: String(r.CandidaturaId),
    tipo: String(r.Tipo),
    occurredAt: new Date(String(r.OccurredAt)),
    note: String(r.Note ?? ""),
    esito: r.Esito != null ? String(r.Esito) : null,
    statoDa: r.StatoDa != null ? String(r.StatoDa) : null,
    statoA: r.StatoA != null ? String(r.StatoA) : null,
    colloquioId: r.ColloquioId != null ? String(r.ColloquioId) : null,
    canale: r.Canale != null ? String(r.Canale) : null,
    createdAt: new Date(String(r.CreatedAt)),
    createdById: String(r.CreatedById),
    createdBy: name
      ? { name: String(r.CreatedByName ?? ""), cognome: r.CreatedByCognome != null ? String(r.CreatedByCognome) : null }
      : undefined,
    createdByName: name,
  };
}

export function mapColloquioRow(r: Record<string, unknown>) {
  return {
    id: String(r.Id),
    tenantId: String(r.TenantId),
    candidaturaId: String(r.CandidaturaId),
    round: Number(r.Round),
    stato: String(r.Stato),
    scheduledAt: new Date(String(r.ScheduledAt)),
    modalita: String(r.Modalita),
    intervistatoreUserId: r.IntervistatoreUserId != null ? String(r.IntervistatoreUserId) : null,
    intervistatoreLabel: String(r.IntervistatoreLabel ?? ""),
    notePreliminari: String(r.NotePreliminari ?? ""),
    noteSvolgimento: String(r.NoteSvolgimento ?? ""),
    esito: r.Esito != null ? String(r.Esito) : null,
    valutazione: String(r.Valutazione ?? ""),
    valutazioneStelle: r.ValutazioneStelle != null ? Number(r.ValutazioneStelle) : null,
    createdAt: new Date(String(r.CreatedAt)),
    updatedAt: new Date(String(r.UpdatedAt)),
    createdById: String(r.CreatedById),
    intervistatore:
      r.IntervistatoreName != null
        ? {
            name: String(r.IntervistatoreName),
            cognome: r.IntervistatoreCognome != null ? String(r.IntervistatoreCognome) : null,
          }
        : undefined,
  };
}

export function mapReceiverRow(r: Record<string, unknown>) {
  return {
    id: String(r.Id),
    tenantId: String(r.TenantId),
    baseUrl: String(r.BaseUrl),
    status: String(r.Status),
    sourceName: r.SourceName != null ? String(r.SourceName) : null,
    createdAt: new Date(String(r.CreatedAt)),
    updatedAt: new Date(String(r.UpdatedAt)),
  };
}
