import "server-only";
import { prisma } from "@/lib/prisma";
import { getOffertaLavoro } from "@/lib/recruiting/offerteRepo";
import { assertOffertaApertaPerCandidature } from "@/lib/recruiting/offerte";
import {
  assertTransizioneCandidatura,
  toCandidaturaRecord,
  type RecruitingCandidaturaRecord,
  type RecruitingCandidaturaWriteInput,
  type StatoCandidatura,
} from "@/lib/recruiting/candidature";
import {
  mapCandidaturaRow,
  newRecruitingId,
  recruitingHasCandidatoAnagrafica,
  candidaturaSelectSql,
  recruitingPool,
  recruitingUsesSql,
  sql,
} from "@/lib/recruiting/sqlDb";

function tenantIdOrThrow(tenantId: string) {
  const id = String(tenantId || "").trim();
  if (!id) throw new Error("Tenant mancante");
  return id;
}

function idOrThrow(id: string, label: string) {
  const value = String(id || "").trim();
  if (!value || value.length > 80) throw new Error(`${label} non indicata`);
  return value;
}

async function prismaCandidaturaSelect(includeOfferta = false) {
  const hasAnagrafica = await recruitingHasCandidatoAnagrafica();
  return {
    id: true,
    tenantId: true,
    offertaId: true,
    externalApplicationId: true,
    receiverCandidateId: true,
    stato: true,
    source: true,
    receivedAt: true,
    updatedAt: true,
    lastSyncAt: true,
    ...(hasAnagrafica ? { cognome: true, nome: true } : {}),
    ...(includeOfferta ? { offerta: { select: { titolo: true } } } : {}),
  };
}

async function assertOffertaDelTenant(tenantId: string, offertaId: string) {
  const offerta = await getOffertaLavoro(tenantId, offertaId);
  if (!offerta) throw new Error("Offerta non trovata");
  return offerta;
}

export async function countCandidatureByOfferta(
  tenantId: string
): Promise<Record<string, number>> {
  const tid = tenantIdOrThrow(tenantId);
  if (!recruitingUsesSql()) {
    const rows = await prisma.recruitingCandidatura.findMany({
      where: { tenantId: tid },
      select: { offertaId: true },
    });
    const counts: Record<string, number> = {};
    for (const row of rows) {
      counts[row.offertaId] = (counts[row.offertaId] || 0) + 1;
    }
    return counts;
  }
  const pool = await recruitingPool();
  const res = await pool
    .request()
    .input("tenantId", sql.NVarChar(64), tid)
    .query(`
      SELECT OffertaId, COUNT(*) AS Cnt
      FROM dbo.RecruitingCandidature
      WHERE TenantId = @tenantId
      GROUP BY OffertaId
    `);
  const counts: Record<string, number> = {};
  for (const row of res.recordset) {
    counts[String(row.OffertaId)] = Number(row.Cnt);
  }
  return counts;
}

/** Tutte le candidature del tenant (home Recruiting, filtri per stato). */
export async function listCandidaturePerHome(
  tenantId: string
): Promise<Array<RecruitingCandidaturaRecord & { offertaTitolo: string }>> {
  const tid = tenantIdOrThrow(tenantId);
  if (!recruitingUsesSql()) {
    const rows = await prisma.recruitingCandidatura.findMany({
      where: { tenantId: tid },
      orderBy: { receivedAt: "desc" },
      select: await prismaCandidaturaSelect(true),
    });
    return rows.map((row) => ({
      ...toCandidaturaRecord(row),
      offertaTitolo: row.offerta?.titolo || "",
    }));
  }
  const pool = await recruitingPool();
  const cols = await candidaturaSelectSql("c");
  const res = await pool
    .request()
    .input("tenantId", sql.NVarChar(64), tid)
    .query(`
      SELECT
        ${cols},
        o.Titolo AS OffertaTitolo
      FROM dbo.RecruitingCandidature c
      INNER JOIN dbo.OfferteLavoro o ON o.Id = c.OffertaId AND o.TenantId = c.TenantId
      WHERE c.TenantId = @tenantId
      ORDER BY c.ReceivedAt DESC
    `);
  return res.recordset.map((row) => ({
    ...toCandidaturaRecord(mapCandidaturaRow(row)),
    offertaTitolo: String(row.OffertaTitolo || ""),
  }));
}

export async function listCandidatureRecenti(
  tenantId: string,
  limit = 50
): Promise<Array<RecruitingCandidaturaRecord & { offertaTitolo: string }>> {
  const tid = tenantIdOrThrow(tenantId);
  const take = Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 100) : 50;
  if (!recruitingUsesSql()) {
    const rows = await prisma.recruitingCandidatura.findMany({
      where: { tenantId: tid },
      orderBy: { receivedAt: "desc" },
      take,
      select: await prismaCandidaturaSelect(true),
    });
    return rows.map((row) => ({
      ...toCandidaturaRecord(row),
      offertaTitolo: row.offerta?.titolo || "",
    }));
  }
  const pool = await recruitingPool();
  const cols = await candidaturaSelectSql("c");
  const res = await pool
    .request()
    .input("tenantId", sql.NVarChar(64), tid)
    .input("take", sql.Int, take)
    .query(`
      SELECT TOP (@take)
        ${cols},
        o.Titolo AS OffertaTitolo
      FROM dbo.RecruitingCandidature c
      INNER JOIN dbo.OfferteLavoro o ON o.Id = c.OffertaId AND o.TenantId = c.TenantId
      WHERE c.TenantId = @tenantId
      ORDER BY c.ReceivedAt DESC
    `);
  return res.recordset.map((row) => ({
    ...toCandidaturaRecord(mapCandidaturaRow(row)),
    offertaTitolo: String(row.OffertaTitolo || ""),
  }));
}

export async function listCandidatureByOfferta(
  tenantId: string,
  offertaId: string
): Promise<RecruitingCandidaturaRecord[]> {
  const tid = tenantIdOrThrow(tenantId);
  const oid = idOrThrow(offertaId, "Offerta");
  await assertOffertaDelTenant(tid, oid);
  if (!recruitingUsesSql()) {
    const rows = await prisma.recruitingCandidatura.findMany({
      where: { tenantId: tid, offertaId: oid },
      orderBy: { receivedAt: "desc" },
      select: await prismaCandidaturaSelect(),
    });
    return rows.map(toCandidaturaRecord);
  }
  const pool = await recruitingPool();
  const cols = await candidaturaSelectSql();
  const res = await pool
    .request()
    .input("tenantId", sql.NVarChar(64), tid)
    .input("offertaId", sql.NVarChar(64), oid)
    .query(`
      SELECT ${cols}
      FROM dbo.RecruitingCandidature
      WHERE TenantId = @tenantId AND OffertaId = @offertaId
      ORDER BY ReceivedAt DESC
    `);
  return res.recordset.map((r) => toCandidaturaRecord(mapCandidaturaRow(r)));
}

export async function getCandidatura(
  tenantId: string,
  id: string,
  offertaId?: string
): Promise<RecruitingCandidaturaRecord | null> {
  const tid = tenantIdOrThrow(tenantId);
  const cid = String(id || "").trim();
  if (!cid) return null;
  const oid = String(offertaId || "").trim();
  if (!recruitingUsesSql()) {
    const row = await prisma.recruitingCandidatura.findFirst({
      where: oid
        ? { id: cid, tenantId: tid, offertaId: oid }
        : { id: cid, tenantId: tid },
      select: await prismaCandidaturaSelect(),
    });
    return row ? toCandidaturaRecord(row) : null;
  }
  const pool = await recruitingPool();
  const cols = await candidaturaSelectSql();
  const req = pool.request().input("tenantId", sql.NVarChar(64), tid).input("id", sql.NVarChar(64), cid);
  let q = `
    SELECT ${cols}
    FROM dbo.RecruitingCandidature
    WHERE Id = @id AND TenantId = @tenantId
  `;
  if (oid) {
    req.input("offertaId", sql.NVarChar(64), oid);
    q += ` AND OffertaId = @offertaId`;
  }
  const res = await req.query(q);
  const row = res.recordset[0];
  return row ? toCandidaturaRecord(mapCandidaturaRow(row)) : null;
}

export async function createCandidatura(
  tenantId: string,
  input: RecruitingCandidaturaWriteInput,
  createdById: string
): Promise<RecruitingCandidaturaRecord> {
  const tid = tenantIdOrThrow(tenantId);
  const authorId = String(createdById || "").trim();
  if (!authorId) throw new Error("Utente mancante");
  const offerta = await assertOffertaDelTenant(tid, input.offertaId);
  assertOffertaApertaPerCandidature(offerta.stato);
  if (!recruitingUsesSql()) {
    const hasAnagrafica = await recruitingHasCandidatoAnagrafica();
    const row = await prisma.$transaction(async (tx) => {
      const created = await tx.recruitingCandidatura.create({
        data: {
          tenantId: tid,
          offertaId: input.offertaId,
          ...(hasAnagrafica ? { cognome: input.cognome, nome: input.nome } : {}),
          stato: "RICEVUTA",
          source: input.source || null,
          externalApplicationId: null,
          receiverCandidateId: null,
          lastSyncAt: null,
        },
      });
      await tx.recruitingAttivita.create({
        data: {
          tenantId: tid,
          candidaturaId: created.id,
          tipo: "RICEZIONE",
          occurredAt: created.receivedAt,
          note: "",
          statoA: "RICEVUTA",
          createdById: authorId,
        },
      });
      return created;
    });
    return toCandidaturaRecord(row);
  }
  const id = newRecruitingId();
  const pool = await recruitingPool();
  const hasAnagrafica = await recruitingHasCandidatoAnagrafica();
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    const ins = new sql.Request(tx)
      .input("id", sql.NVarChar(64), id)
      .input("tenantId", sql.NVarChar(64), tid)
      .input("offertaId", sql.NVarChar(64), input.offertaId)
      .input("source", sql.NVarChar(80), input.source || null);
    if (hasAnagrafica) {
      ins.input("cognome", sql.NVarChar(80), input.cognome).input("nome", sql.NVarChar(80), input.nome);
      await ins.query(`
        INSERT INTO dbo.RecruitingCandidature (
          Id, TenantId, OffertaId, ExternalApplicationId, ReceiverCandidateId,
          Cognome, Nome, Stato, Source, ReceivedAt, UpdatedAt, LastSyncAt
        ) VALUES (
          @id, @tenantId, @offertaId, NULL, NULL,
          @cognome, @nome, N'RICEVUTA', @source, SYSUTCDATETIME(), SYSUTCDATETIME(), NULL
        )
      `);
    } else {
      await ins.query(`
        INSERT INTO dbo.RecruitingCandidature (
          Id, TenantId, OffertaId, ExternalApplicationId, ReceiverCandidateId,
          Stato, Source, ReceivedAt, UpdatedAt, LastSyncAt
        ) VALUES (
          @id, @tenantId, @offertaId, NULL, NULL,
          N'RICEVUTA', @source, SYSUTCDATETIME(), SYSUTCDATETIME(), NULL
        )
      `);
    }
    await new sql.Request(tx)
      .input("aid", sql.NVarChar(64), newRecruitingId())
      .input("tenantId", sql.NVarChar(64), tid)
      .input("candidaturaId", sql.NVarChar(64), id)
      .input("createdById", sql.NVarChar(64), authorId)
      .query(`
        INSERT INTO dbo.RecruitingAttivita (
          Id, TenantId, CandidaturaId, Tipo, OccurredAt, Note, Esito,
          StatoDa, StatoA, ColloquioId, Canale, CreatedAt, CreatedById
        ) VALUES (
          @aid, @tenantId, @candidaturaId, N'RICEZIONE', SYSUTCDATETIME(), N'', NULL,
          NULL, N'RICEVUTA', NULL, NULL, SYSUTCDATETIME(), @createdById
        )
      `);
    await tx.commit();
  } catch (e) {
    await tx.rollback();
    throw e;
  }
  const created = await getCandidatura(tid, id);
  if (!created) throw new Error("Candidatura non creata");
  return created;
}

export async function updateCandidaturaStato(
  tenantId: string,
  id: string,
  stato: StatoCandidatura,
  createdById: string
): Promise<RecruitingCandidaturaRecord> {
  const tid = tenantIdOrThrow(tenantId);
  const cid = idOrThrow(id, "Candidatura");
  const authorId = String(createdById || "").trim();
  if (!authorId) throw new Error("Utente mancante");
  const current = await getCandidatura(tid, cid);
  if (!current) throw new Error("Candidatura non trovata");
  await assertOffertaDelTenant(tid, current.offertaId);
  assertTransizioneCandidatura(current.stato, stato);
  if (!recruitingUsesSql()) {
    await prisma.$transaction(async (tx) => {
      const result = await tx.recruitingCandidatura.updateMany({
        where: { id: cid, tenantId: tid, offertaId: current.offertaId },
        data: { stato },
      });
      if (result.count !== 1) throw new Error("Candidatura non trovata");
      await tx.recruitingAttivita.create({
        data: {
          tenantId: tid,
          candidaturaId: cid,
          tipo: "CAMBIO_STATO",
          occurredAt: new Date(),
          note: "",
          statoDa: current.stato,
          statoA: stato,
          createdById: authorId,
        },
      });
    });
  } else {
    const pool = await recruitingPool();
    const tx = new sql.Transaction(pool);
    await tx.begin();
    try {
      const upd = await new sql.Request(tx)
        .input("id", sql.NVarChar(64), cid)
        .input("tenantId", sql.NVarChar(64), tid)
        .input("offertaId", sql.NVarChar(64), current.offertaId)
        .input("stato", sql.NVarChar(30), stato)
        .query(`
          UPDATE dbo.RecruitingCandidature
          SET Stato = @stato, UpdatedAt = SYSUTCDATETIME()
          WHERE Id = @id AND TenantId = @tenantId AND OffertaId = @offertaId
        `);
      if (upd.rowsAffected[0] !== 1) throw new Error("Candidatura non trovata");
      await new sql.Request(tx)
        .input("aid", sql.NVarChar(64), newRecruitingId())
        .input("tenantId", sql.NVarChar(64), tid)
        .input("candidaturaId", sql.NVarChar(64), cid)
        .input("statoDa", sql.NVarChar(30), current.stato)
        .input("statoA", sql.NVarChar(30), stato)
        .input("createdById", sql.NVarChar(64), authorId)
        .query(`
          INSERT INTO dbo.RecruitingAttivita (
            Id, TenantId, CandidaturaId, Tipo, OccurredAt, Note, Esito,
            StatoDa, StatoA, ColloquioId, Canale, CreatedAt, CreatedById
          ) VALUES (
            @aid, @tenantId, @candidaturaId, N'CAMBIO_STATO', SYSUTCDATETIME(), N'', NULL,
            @statoDa, @statoA, NULL, NULL, SYSUTCDATETIME(), @createdById
          )
        `);
      await tx.commit();
    } catch (e) {
      await tx.rollback();
      throw e;
    }
  }
  const updated = await getCandidatura(tid, cid);
  if (!updated) throw new Error("Candidatura non trovata");
  return updated;
}
