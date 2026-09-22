import "server-only";
import { prisma } from "@/lib/prisma";
import {
  assertTransizioneOfferta,
  toOffertaLavoroRecord,
  type OffertaLavoroRecord,
  type OffertaLavoroWriteInput,
} from "@/lib/recruiting/offerte";
import {
  mapOffertaRow,
  newRecruitingId,
  recruitingPool,
  recruitingUsesSql,
  sql,
} from "@/lib/recruiting/sqlDb";

function tenantIdOrThrow(tenantId: string) {
  const id = String(tenantId || "").trim();
  if (!id) throw new Error("Tenant mancante");
  return id;
}

function offertaIdOrThrow(id: string) {
  const oid = String(id || "").trim();
  if (!oid || oid.length > 80) throw new Error("Offerta non indicata");
  return oid;
}

const OFFERTA_COLS = `
  Id, TenantId, Titolo, Luogo, ModalitaLavoro, TipoContratto, Orario, NumeroPosizioni,
  Descrizione, AttivitaPrincipali, Requisiti, Competenze, Retribuzione, Benefit, Paese,
  Stato, IndeedJobId, CreatedAt, UpdatedAt
`;

/** Elenco offerte del tenant (isolamento obbligatorio). */
export async function listOfferteLavoro(tenantId: string): Promise<OffertaLavoroRecord[]> {
  const tid = tenantIdOrThrow(tenantId);
  if (!recruitingUsesSql()) {
    const rows = await prisma.offertaLavoro.findMany({
      where: { tenantId: tid },
      orderBy: { updatedAt: "desc" },
    });
    return rows.map(toOffertaLavoroRecord);
  }
  const pool = await recruitingPool();
  const res = await pool
    .request()
    .input("tenantId", sql.NVarChar(64), tid)
    .query(
      `SELECT ${OFFERTA_COLS} FROM dbo.OfferteLavoro WHERE TenantId = @tenantId ORDER BY UpdatedAt DESC`
    );
  return res.recordset.map((r) => toOffertaLavoroRecord(mapOffertaRow(r)));
}

export async function getOffertaLavoro(
  tenantId: string,
  id: string
): Promise<OffertaLavoroRecord | null> {
  const tid = tenantIdOrThrow(tenantId);
  const oid = String(id || "").trim();
  if (!oid) return null;
  if (!recruitingUsesSql()) {
    const row = await prisma.offertaLavoro.findFirst({
      where: { id: oid, tenantId: tid },
    });
    return row ? toOffertaLavoroRecord(row) : null;
  }
  const pool = await recruitingPool();
  const res = await pool
    .request()
    .input("tenantId", sql.NVarChar(64), tid)
    .input("id", sql.NVarChar(64), oid)
    .query(
      `SELECT ${OFFERTA_COLS} FROM dbo.OfferteLavoro WHERE Id = @id AND TenantId = @tenantId`
    );
  const row = res.recordset[0];
  return row ? toOffertaLavoroRecord(mapOffertaRow(row)) : null;
}

/**
 * Lookup offerta Credixa per Indeed jobId, isolato per tenant.
 * Non crea offerte. Restituisce null se job sconosciuto per il tenant.
 */
export async function findOffertaByIndeedJobId(
  tenantId: string,
  indeedJobId: string
): Promise<OffertaLavoroRecord | null> {
  const tid = tenantIdOrThrow(tenantId);
  const jid = String(indeedJobId || "").trim();
  if (!jid || jid.length > 200) return null;
  if (!recruitingUsesSql()) {
    const row = await prisma.offertaLavoro.findFirst({
      where: { tenantId: tid, indeedJobId: jid },
    });
    return row ? toOffertaLavoroRecord(row) : null;
  }
  const pool = await recruitingPool();
  const res = await pool
    .request()
    .input("tenantId", sql.NVarChar(64), tid)
    .input("indeedJobId", sql.NVarChar(200), jid)
    .query(
      `SELECT ${OFFERTA_COLS}
       FROM dbo.OfferteLavoro
       WHERE TenantId = @tenantId AND IndeedJobId = @indeedJobId`
    );
  const row = res.recordset[0];
  return row ? toOffertaLavoroRecord(mapOffertaRow(row)) : null;
}

export async function createOffertaLavoro(
  tenantId: string,
  input: OffertaLavoroWriteInput
): Promise<OffertaLavoroRecord> {
  const tid = tenantIdOrThrow(tenantId);
  const stato = input.stato || "BOZZA";
  if (stato === "CHIUSA") {
    throw new Error("Usa l'azione di chiusura per chiudere un'offerta");
  }
  if (!recruitingUsesSql()) {
    const row = await prisma.offertaLavoro.create({
      data: {
        tenantId: tid,
        titolo: input.titolo,
        luogo: input.luogo,
        modalitaLavoro: input.modalitaLavoro,
        tipoContratto: input.tipoContratto,
        orario: input.orario,
        numeroPosizioni: input.numeroPosizioni,
        descrizione: input.descrizione,
        attivitaPrincipali: input.attivitaPrincipali,
        requisiti: input.requisiti,
        competenze: input.competenze,
        retribuzione: input.retribuzione,
        benefit: input.benefit,
        paese: "IT",
        stato,
        indeedJobId: null,
      },
    });
    return toOffertaLavoroRecord(row);
  }
  const id = newRecruitingId();
  const pool = await recruitingPool();
  const req = pool.request();
  req.input("id", sql.NVarChar(64), id);
  req.input("tenantId", sql.NVarChar(64), tid);
  req.input("titolo", sql.NVarChar(200), input.titolo);
  req.input("luogo", sql.NVarChar(200), input.luogo);
  req.input("modalita", sql.NVarChar(20), input.modalitaLavoro);
  req.input("contratto", sql.NVarChar(40), input.tipoContratto);
  req.input("orario", sql.NVarChar(20), input.orario);
  req.input("nPos", sql.Int, input.numeroPosizioni);
  req.input("desc", sql.NVarChar(sql.MAX), input.descrizione);
  req.input("att", sql.NVarChar(sql.MAX), input.attivitaPrincipali);
  req.input("req", sql.NVarChar(sql.MAX), input.requisiti);
  req.input("comp", sql.NVarChar(sql.MAX), input.competenze);
  req.input("ret", sql.NVarChar(500), input.retribuzione);
  req.input("ben", sql.NVarChar(sql.MAX), input.benefit);
  req.input("stato", sql.NVarChar(20), stato);
  await req.query(`
    INSERT INTO dbo.OfferteLavoro (
      Id, TenantId, Titolo, Luogo, ModalitaLavoro, TipoContratto, Orario, NumeroPosizioni,
      Descrizione, AttivitaPrincipali, Requisiti, Competenze, Retribuzione, Benefit, Paese,
      Stato, IndeedJobId, CreatedAt, UpdatedAt
    ) VALUES (
      @id, @tenantId, @titolo, @luogo, @modalita, @contratto, @orario, @nPos,
      @desc, @att, @req, @comp, @ret, @ben, N'IT', @stato, NULL,
      SYSUTCDATETIME(), SYSUTCDATETIME()
    )
  `);
  const created = await getOffertaLavoro(tid, id);
  if (!created) throw new Error("Offerta non creata");
  return created;
}

export async function updateOffertaLavoro(
  tenantId: string,
  id: string,
  input: OffertaLavoroWriteInput
): Promise<OffertaLavoroRecord> {
  const tid = tenantIdOrThrow(tenantId);
  const oid = offertaIdOrThrow(id);
  const current = await getOffertaLavoro(tid, oid);
  if (!current) throw new Error("Offerta non trovata");
  // Contenuti sempre modificabili; offerta chiusa resta chiusa.
  const nextStato =
    current.stato === "CHIUSA" ? "CHIUSA" : input.stato || current.stato;
  assertTransizioneOfferta(current.stato, nextStato);
  if (!recruitingUsesSql()) {
    const result = await prisma.offertaLavoro.updateMany({
      where: { id: oid, tenantId: tid },
      data: {
        titolo: input.titolo,
        luogo: input.luogo,
        modalitaLavoro: input.modalitaLavoro,
        tipoContratto: input.tipoContratto,
        orario: input.orario,
        numeroPosizioni: input.numeroPosizioni,
        descrizione: input.descrizione,
        attivitaPrincipali: input.attivitaPrincipali,
        requisiti: input.requisiti,
        competenze: input.competenze,
        retribuzione: input.retribuzione,
        benefit: input.benefit,
        stato: nextStato,
      },
    });
    if (result.count !== 1) throw new Error("Offerta non trovata");
  } else {
    const pool = await recruitingPool();
    const req = pool.request();
    req.input("id", sql.NVarChar(64), oid);
    req.input("tenantId", sql.NVarChar(64), tid);
    req.input("titolo", sql.NVarChar(200), input.titolo);
    req.input("luogo", sql.NVarChar(200), input.luogo);
    req.input("modalita", sql.NVarChar(20), input.modalitaLavoro);
    req.input("contratto", sql.NVarChar(40), input.tipoContratto);
    req.input("orario", sql.NVarChar(20), input.orario);
    req.input("nPos", sql.Int, input.numeroPosizioni);
    req.input("desc", sql.NVarChar(sql.MAX), input.descrizione);
    req.input("att", sql.NVarChar(sql.MAX), input.attivitaPrincipali);
    req.input("req", sql.NVarChar(sql.MAX), input.requisiti);
    req.input("comp", sql.NVarChar(sql.MAX), input.competenze);
    req.input("ret", sql.NVarChar(500), input.retribuzione);
    req.input("ben", sql.NVarChar(sql.MAX), input.benefit);
    req.input("stato", sql.NVarChar(20), nextStato);
    const result = await req.query(`
      UPDATE dbo.OfferteLavoro SET
        Titolo = @titolo, Luogo = @luogo, ModalitaLavoro = @modalita, TipoContratto = @contratto,
        Orario = @orario, NumeroPosizioni = @nPos, Descrizione = @desc, AttivitaPrincipali = @att,
        Requisiti = @req, Competenze = @comp, Retribuzione = @ret, Benefit = @ben,
        Stato = @stato, UpdatedAt = SYSUTCDATETIME()
      WHERE Id = @id AND TenantId = @tenantId
    `);
    if (result.rowsAffected[0] !== 1) throw new Error("Offerta non trovata");
  }
  const updated = await getOffertaLavoro(tid, oid);
  if (!updated) throw new Error("Offerta non trovata");
  return updated;
}

export async function countCandidatureOfferta(
  tenantId: string,
  offertaId: string
): Promise<number> {
  const tid = tenantIdOrThrow(tenantId);
  const oid = offertaIdOrThrow(offertaId);
  if (!recruitingUsesSql()) {
    return prisma.recruitingCandidatura.count({
      where: { tenantId: tid, offertaId: oid },
    });
  }
  const pool = await recruitingPool();
  const res = await pool
    .request()
    .input("tenantId", sql.NVarChar(64), tid)
    .input("offertaId", sql.NVarChar(64), oid)
    .query(`
      SELECT COUNT(*) AS Cnt
      FROM dbo.RecruitingCandidature
      WHERE TenantId = @tenantId AND OffertaId = @offertaId
    `);
  return Number(res.recordset[0]?.Cnt ?? 0);
}

/** Elimina offerta solo se non ha candidature collegate. */
export async function deleteOffertaLavoro(
  tenantId: string,
  id: string
): Promise<void> {
  const tid = tenantIdOrThrow(tenantId);
  const oid = offertaIdOrThrow(id);
  const current = await getOffertaLavoro(tid, oid);
  if (!current) throw new Error("Offerta non trovata");
  const n = await countCandidatureOfferta(tid, oid);
  if (n > 0) {
    throw new Error(
      "Non si può eliminare: ci sono candidature o attività collegate a questa offerta"
    );
  }
  if (!recruitingUsesSql()) {
    const result = await prisma.offertaLavoro.deleteMany({
      where: { id: oid, tenantId: tid },
    });
    if (result.count !== 1) throw new Error("Offerta non trovata");
    return;
  }
  const pool = await recruitingPool();
  const result = await pool
    .request()
    .input("id", sql.NVarChar(64), oid)
    .input("tenantId", sql.NVarChar(64), tid)
    .query(`DELETE FROM dbo.OfferteLavoro WHERE Id = @id AND TenantId = @tenantId`);
  if (result.rowsAffected[0] !== 1) throw new Error("Offerta non trovata");
}

export async function chiudiOffertaLavoro(
  tenantId: string,
  id: string
): Promise<OffertaLavoroRecord> {
  const tid = tenantIdOrThrow(tenantId);
  const oid = offertaIdOrThrow(id);
  const current = await getOffertaLavoro(tid, oid);
  if (!current) throw new Error("Offerta non trovata");
  if (current.stato === "CHIUSA") return current;
  if (!recruitingUsesSql()) {
    const result = await prisma.offertaLavoro.updateMany({
      where: { id: oid, tenantId: tid, stato: { not: "CHIUSA" } },
      data: { stato: "CHIUSA" },
    });
    if (result.count !== 1) throw new Error("Offerta non trovata");
  } else {
    const pool = await recruitingPool();
    const result = await pool
      .request()
      .input("id", sql.NVarChar(64), oid)
      .input("tenantId", sql.NVarChar(64), tid)
      .query(`
        UPDATE dbo.OfferteLavoro SET Stato = N'CHIUSA', UpdatedAt = SYSUTCDATETIME()
        WHERE Id = @id AND TenantId = @tenantId AND Stato <> N'CHIUSA'
      `);
    if (result.rowsAffected[0] !== 1) throw new Error("Offerta non trovata");
  }
  const updated = await getOffertaLavoro(tid, oid);
  if (!updated) throw new Error("Offerta non trovata");
  return updated;
}

/**
 * Assegna IndeedJobId se mancante (bridge CreditCore → Receiver → sync Credixa).
 * Formato stabile multi-azienda: CREDIXA-{tenantId}-{offertaId}
 * (se già presente un id legacy CREDIXA-{offertaId} non viene riassegnato).
 */
export async function ensureOffertaIndeedJobId(
  tenantId: string,
  offertaId: string
): Promise<OffertaLavoroRecord> {
  const tid = tenantIdOrThrow(tenantId);
  const oid = offertaIdOrThrow(offertaId);
  const current = await getOffertaLavoro(tid, oid);
  if (!current) throw new Error("Offerta non trovata");
  if (current.indeedJobId && current.indeedJobId.trim()) return current;

  const indeedJobId = `CREDIXA-${tid}-${oid}`.slice(0, 200);
  if (!recruitingUsesSql()) {
    await prisma.offertaLavoro.updateMany({
      where: { id: oid, tenantId: tid, indeedJobId: null },
      data: { indeedJobId },
    });
  } else {
    const pool = await recruitingPool();
    await pool
      .request()
      .input("id", sql.NVarChar(64), oid)
      .input("tenantId", sql.NVarChar(64), tid)
      .input("indeedJobId", sql.NVarChar(200), indeedJobId)
      .query(`
        UPDATE dbo.OfferteLavoro
        SET IndeedJobId = @indeedJobId, UpdatedAt = SYSUTCDATETIME()
        WHERE Id = @id AND TenantId = @tenantId
          AND (IndeedJobId IS NULL OR LTRIM(RTRIM(IndeedJobId)) = N'')
      `);
  }
  const updated = await getOffertaLavoro(tid, oid);
  if (!updated) throw new Error("Offerta non trovata");
  return updated;
}
