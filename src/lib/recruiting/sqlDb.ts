import "server-only";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { randomBytes } from "node:crypto";
import sql from "mssql";
import { isConnectorProvider } from "@/lib/data/factory";

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

let pool: sql.ConnectionPool | null = null;

export function recruitingUsesSql() {
  return isConnectorProvider();
}

export function newRecruitingId() {
  return `c${randomBytes(12).toString("hex")}`;
}

export async function recruitingPool(): Promise<sql.ConnectionPool> {
  if (pool?.connected) return pool;
  pool = await sql.connect({
    server: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 1433),
    database: process.env.DB_NAME || "CredixaDev",
    user: process.env.DB_USER || "credixa_dev",
    password: process.env.DB_PASSWORD || "",
    options: { encrypt: false, trustServerCertificate: true },
  });
  return pool;
}

export { sql };

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
  return {
    id: String(r.Id),
    tenantId: String(r.TenantId),
    offertaId: String(r.OffertaId),
    externalApplicationId: r.ExternalApplicationId != null ? String(r.ExternalApplicationId) : null,
    receiverCandidateId: r.ReceiverCandidateId != null ? String(r.ReceiverCandidateId) : null,
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
