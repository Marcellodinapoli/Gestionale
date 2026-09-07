import { sql, getPool } from "../db/pool.js";
import type { ConnectorConfig } from "../config.js";
import { createAttivita } from "./attivitaService.js";
import { getPraticaById, updatePratica, getPraticaRelations } from "./praticheService.js";
import { appendAuditLog } from "./auditService.js";
import { getLockStatus, acquireLock, renewLock } from "./lockService.js";
import bcrypt from "bcryptjs";
import { getTenantBySlug } from "./usersService.js";

export type CreditCalcUser = {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  role: string;
  consulenteEsterno: boolean;
  creditCalcEnabled: boolean;
  active: boolean;
};

async function loadUser(
  cfg: ConnectorConfig["db"],
  tenantId: string,
  userId: string
): Promise<CreditCalcUser | null> {
  const pool = await getPool(cfg);
  const res = await pool
    .request()
    .input("tenantId", sql.UniqueIdentifier, tenantId)
    .input("userId", sql.UniqueIdentifier, userId)
    .query(`
      SELECT Id, TenantId, Email, Name, Role, Active,
        ISNULL(ConsulenteEsterno, 0) AS ConsulenteEsterno,
        ISNULL(CreditCalcEnabled, 0) AS CreditCalcEnabled
      FROM dbo.Users
      WHERE Id = @userId AND TenantId = @tenantId
    `);
  const r = res.recordset[0] as Record<string, unknown> | undefined;
  if (!r) return null;
  return {
    id: String(r.Id),
    tenantId: String(r.TenantId),
    email: String(r.Email),
    name: String(r.Name),
    role: String(r.Role),
    consulenteEsterno: Boolean(r.ConsulenteEsterno),
    creditCalcEnabled: Boolean(r.CreditCalcEnabled),
    active: Boolean(r.Active),
  };
}

export async function assertCreditCalcAccess(
  cfg: ConnectorConfig["db"],
  tenantId: string,
  userId: string
): Promise<CreditCalcUser> {
  const user = await loadUser(cfg, tenantId, userId);
  if (!user || !user.active) {
    const err = new Error("Utente non trovato o non attivo");
    (err as Error & { status: number }).status = 403;
    throw err;
  }
  if (!user.consulenteEsterno || !user.creditCalcEnabled) {
    const err = new Error(
      "Accesso CreditCalc non autorizzato. Contattare amministrazione."
    );
    (err as Error & { status: number }).status = 403;
    throw err;
  }
  return user;
}

export async function getCreditCalcProfile(
  cfg: ConnectorConfig["db"],
  tenantId: string,
  userId: string
) {
  const user = await assertCreditCalcAccess(cfg, tenantId, userId);
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    consulenteEsterno: true,
    creditCalcEnabled: true,
    capabilities: {
      openPratiche: true,
      addNote: true,
      setCodiceScarico: true,
    },
  };
}

/** Login CreditCalc: email+password, solo consulente con accesso abilitato. */
export async function loginCreditCalc(
  cfg: ConnectorConfig,
  input: { tenantSlug: string; email: string; password: string }
) {
  const slug = String(input.tenantSlug || "").trim().toLowerCase();
  const email = String(input.email || "").trim().toLowerCase();
  const password = String(input.password || "");
  if (!slug || !email || !password) {
    const err = new Error("Azienda, email e password obbligatori");
    (err as Error & { status: number }).status = 400;
    throw err;
  }

  const tenant = await getTenantBySlug(cfg, slug);
  if (!tenant || tenant.Active === false) {
    const err = new Error("Azienda non trovata o non attiva");
    (err as Error & { status: number }).status = 403;
    throw err;
  }
  const tenantId = String(tenant.Id);

  const pool = await getPool(cfg.db);
  const res = await pool
    .request()
    .input("tenantId", sql.UniqueIdentifier, tenantId)
    .input("email", sql.NVarChar(320), email)
    .query(`
      SELECT Id, TenantId, Email, Name, Role, Active, PasswordHash,
        ISNULL(ConsulenteEsterno, 0) AS ConsulenteEsterno,
        ISNULL(CreditCalcEnabled, 0) AS CreditCalcEnabled
      FROM dbo.Users
      WHERE TenantId = @tenantId AND Email = @email
    `);
  const r = res.recordset[0] as Record<string, unknown> | undefined;
  if (!r || !r.Active) {
    const err = new Error("Credenziali non valide");
    (err as Error & { status: number }).status = 403;
    throw err;
  }
  const hash = String(r.PasswordHash || "");
  const ok = hash ? await bcrypt.compare(password, hash) : false;
  if (!ok) {
    const err = new Error("Credenziali non valide");
    (err as Error & { status: number }).status = 403;
    throw err;
  }
  if (!r.ConsulenteEsterno || !r.CreditCalcEnabled) {
    const err = new Error(
      "Accesso CreditCalc non autorizzato. Contattare amministrazione."
    );
    (err as Error & { status: number }).status = 403;
    throw err;
  }

  return {
    tenantSlug: slug,
    tenantId,
    profile: {
      id: String(r.Id),
      email: String(r.Email),
      name: String(r.Name),
      role: String(r.Role),
      consulenteEsterno: true,
      creditCalcEnabled: true,
      capabilities: {
        openPratiche: true,
        addNote: true,
        setCodiceScarico: true,
      },
    },
  };
}

async function assertPraticaAffidata(
  cfg: ConnectorConfig["db"],
  tenantId: string,
  praticaId: string,
  userId: string
) {
  const pool = await getPool(cfg);
  const res = await pool
    .request()
    .input("tenantId", sql.UniqueIdentifier, tenantId)
    .input("praticaId", sql.UniqueIdentifier, praticaId)
    .input("userId", sql.UniqueIdentifier, userId)
    .query(`
      SELECT p.Id
      FROM dbo.Pratiche p
      WHERE p.Id = @praticaId AND p.TenantId = @tenantId
        AND p.AssegnatarioId = @userId
    `);
  if (!res.recordset[0]) {
    const err = new Error("Pratica non in affido a questo consulente");
    (err as Error & { status: number }).status = 403;
    throw err;
  }
}

export async function listPraticheAffidateCreditCalc(
  cfg: ConnectorConfig["db"],
  tenantId: string,
  userId: string,
  opts?: { take?: number; skip?: number }
) {
  await assertCreditCalcAccess(cfg, tenantId, userId);
  const take = Math.min(Math.max(opts?.take ?? 50, 1), 200);
  const skip = Math.max(opts?.skip ?? 0, 0);
  const pool = await getPool(cfg);
  const req = pool
    .request()
    .input("tenantId", sql.UniqueIdentifier, tenantId)
    .input("userId", sql.UniqueIdentifier, userId)
    .input("take", sql.Int, take)
    .input("skip", sql.Int, skip);

  const countRes = await req.query(`
    SELECT COUNT(*) AS total
    FROM dbo.Pratiche p
    WHERE p.TenantId = @tenantId AND p.AssegnatarioId = @userId
  `);
  const total = Number(countRes.recordset[0]?.total ?? 0);

  const listRes = await pool
    .request()
    .input("tenantId", sql.UniqueIdentifier, tenantId)
    .input("userId", sql.UniqueIdentifier, userId)
    .input("take", sql.Int, take)
    .input("skip", sql.Int, skip)
    .query(`
      SELECT p.Id AS id, p.Numero AS numero, p.Stato AS stato,
        p.CodiceScarico AS codiceScarico, p.Residuo AS residuo,
        p.NumeroMandante AS numeroMandante, p.UpdatedAt AS updatedAt,
        d.Cognome AS debitoreCognome, d.Nome AS debitoreNome,
        m.Codice AS mandanteCodice, m.RagioneSociale AS mandanteNome
      FROM dbo.Pratiche p
      INNER JOIN dbo.Debitori d ON d.Id = p.DebitoreId
      LEFT JOIN dbo.Mandanti m ON m.Id = p.MandanteId
      WHERE p.TenantId = @tenantId AND p.AssegnatarioId = @userId
      ORDER BY p.UpdatedAt DESC
      OFFSET @skip ROWS FETCH NEXT @take ROWS ONLY
    `);

  return {
    total,
    items: listRes.recordset.map((r: Record<string, unknown>) => ({
      id: String(r.id),
      numero: r.numero != null ? String(r.numero) : null,
      stato: r.stato != null ? String(r.stato) : null,
      codiceScarico: r.codiceScarico != null ? String(r.codiceScarico) : null,
      residuo: r.residuo != null ? Number(r.residuo) : null,
      numeroMandante: r.numeroMandante != null ? String(r.numeroMandante) : null,
      updatedAt: r.updatedAt ? new Date(String(r.updatedAt)).toISOString() : null,
      debitore: `${r.debitoreCognome || ""} ${r.debitoreNome || ""}`.trim(),
      mandanteCodice: r.mandanteCodice != null ? String(r.mandanteCodice) : null,
      mandanteNome: r.mandanteNome != null ? String(r.mandanteNome) : null,
    })),
  };
}

export async function getPraticaCreditCalc(
  cfg: ConnectorConfig["db"],
  tenantId: string,
  userId: string,
  praticaId: string
) {
  await assertCreditCalcAccess(cfg, tenantId, userId);
  await assertPraticaAffidata(cfg, tenantId, praticaId, userId);
  const pratica = await getPraticaById(cfg, tenantId, praticaId);
  if (!pratica) {
    const err = new Error("Pratica non trovata");
    (err as Error & { status: number }).status = 404;
    throw err;
  }

  const [notePool, relations] = await Promise.all([
    (async () => {
      const pool = await getPool(cfg);
      return pool
        .request()
        .input("tenantId", sql.UniqueIdentifier, tenantId)
        .input("praticaId", sql.UniqueIdentifier, praticaId)
        .query(`
          SELECT TOP 50 a.Id AS id, a.Nota AS nota, a.CreatedAt AS createdAt,
            u.Name AS userName, a.Fissata AS fissata, a.Importante AS importante
          FROM dbo.Attivita a
          LEFT JOIN dbo.Users u ON u.Id = a.UserId
          WHERE a.TenantId = @tenantId AND a.PraticaId = @praticaId AND a.Tipo = N'NOTA'
          ORDER BY a.CreatedAt DESC
        `);
    })(),
    getPraticaRelations(cfg, tenantId, praticaId, [
      "debitoreRecapiti",
      "garanti",
      "garantiRecapiti",
      "rate",
      "incassi",
      "fatture",
      "documenti",
    ]),
  ]);

  const mapRows = (rows: unknown) =>
    Array.isArray(rows)
      ? rows.map((r) => {
          const row = r as Record<string, unknown>;
          const out: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(row)) {
            if (v instanceof Date) out[k] = v.toISOString();
            else if (typeof v === "object" && v !== null && "value" in (v as object)) {
              out[k] = (v as { valueOf: () => unknown }).valueOf?.() ?? v;
            } else out[k] = v;
          }
          return out;
        })
      : [];

  return {
    pratica,
    note: notePool.recordset.map((r: Record<string, unknown>) => ({
      id: String(r.id),
      nota: r.nota != null ? String(r.nota) : null,
      createdAt: r.createdAt ? new Date(String(r.createdAt)).toISOString() : null,
      userName: r.userName != null ? String(r.userName) : null,
      fissata: Boolean(r.fissata),
      importante: Boolean(r.importante),
    })),
    debitoreRecapiti: mapRows(relations.debitoreRecapiti),
    garanti: mapRows(relations.garanti),
    garanteRecapiti: mapRows(relations.garanteRecapiti),
    rate: mapRows(relations.rate),
    incassi: mapRows(relations.incassi),
    fatture: mapRows(relations.fatture),
    documenti: mapRows(relations.documenti),
  };
}

export async function lavorazioneCreditCalc(
  cfg: ConnectorConfig["db"],
  tenantId: string,
  userId: string,
  praticaId: string,
  input: { nota?: string | null; codiceScarico?: string | null }
) {
  await assertCreditCalcAccess(cfg, tenantId, userId);
  await assertPraticaAffidata(cfg, tenantId, praticaId, userId);

  // Stesso lock del gestionale PC: secondo operatore in sola lettura.
  const lock = await getLockStatus(cfg, tenantId, praticaId, userId);
  if (lock.owned) {
    await renewLock(cfg, tenantId, praticaId, userId);
  } else if (lock.lockedBy) {
    const err = new Error(`Pratica in uso da ${lock.lockedBy.name}`);
    (err as Error & { status: number }).status = 409;
    throw err;
  } else {
    const acquired = await acquireLock(cfg, tenantId, praticaId, userId);
    if (!acquired.owned) {
      const name = acquired.lockedBy?.name ?? "un altro operatore";
      const err = new Error(`Pratica in uso da ${name}`);
      (err as Error & { status: number }).status = 409;
      throw err;
    }
  }

  const nota = String(input.nota || "").trim();
  const codiceScarico = String(input.codiceScarico || "").trim().toUpperCase() || null;

  if (!nota && !codiceScarico) {
    const err = new Error("Inserire una nota e/o un codice scarico");
    (err as Error & { status: number }).status = 400;
    throw err;
  }

  if (nota) {
    await createAttivita(cfg, tenantId, {
      praticaId,
      userId,
      tipo: "NOTA",
      nota,
    });
  }

  const now = new Date();
  const update: Record<string, unknown> = {
    ultimaLavorazioneAt: now,
  };

  if (codiceScarico) {
    update.codiceScarico = codiceScarico;
    update.codiceScaricoAt = now;
    // Sit. affido (RESA/INESIGIBILE) dipende solo dal codice bk off, non dallo scarico operatore.
  }

  const pratica = await updatePratica(cfg, tenantId, praticaId, update);

  await appendAuditLog(cfg, tenantId, {
    userId,
    action: codiceScarico ? "scarico_update" : "nota",
    entity: "pratica",
    entityId: praticaId,
    dettaglio: [codiceScarico || null, nota ? nota.slice(0, 200) : null]
      .filter(Boolean)
      .join(" · "),
  });

  return { ok: true, pratica };
}
