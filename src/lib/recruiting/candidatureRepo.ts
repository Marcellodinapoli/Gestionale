import "server-only";
import { prisma } from "@/lib/prisma";
import { getOffertaLavoro } from "@/lib/recruiting/offerteRepo";
import { assertOffertaApertaPerCandidature } from "@/lib/recruiting/offerte";
import {
  mapCandidaturaRow,
  newRecruitingId,
  recruitingHasCandidatoAnagrafica,
  recruitingHasCandidatoIndeedApplyFields,
  candidaturaSelectSql,
  recruitingPool,
  recruitingUsesSql,
  sql,
} from "@/lib/recruiting/sqlDb";
import {
  pickContactDuplicate,
} from "@/lib/recruiting/candidaturaIdentity";
import {
  assertTransizioneCandidatura,
  toCandidaturaRecord,
  validaCandidaturaReceiverUpsertInput,
  type RecruitingCandidaturaRecord,
  type RecruitingCandidaturaReceiverUpsertInput,
  type RecruitingCandidaturaWriteInput,
  type StatoCandidatura,
} from "@/lib/recruiting/candidature";

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
  const hasIndeedApply = await recruitingHasCandidatoIndeedApplyFields();
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
    ...(hasIndeedApply
      ? { email: true, emailVerified: true, phone: true, coverLetter: true }
      : {}),
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

/** Lookup per idempotenza Indeed Apply (tenant + externalApplicationId). */
export async function findCandidaturaByExternalApplicationId(
  tenantId: string,
  externalApplicationId: string
): Promise<RecruitingCandidaturaRecord | null> {
  const tid = tenantIdOrThrow(tenantId);
  const ext = String(externalApplicationId || "").trim();
  if (!ext) return null;
  if (!recruitingUsesSql()) {
    const row = await prisma.recruitingCandidatura.findFirst({
      where: { tenantId: tid, externalApplicationId: ext },
      select: await prismaCandidaturaSelect(),
    });
    return row ? toCandidaturaRecord(row) : null;
  }
  const pool = await recruitingPool();
  const cols = await candidaturaSelectSql();
  const res = await pool
    .request()
    .input("tenantId", sql.NVarChar(64), tid)
    .input("externalApplicationId", sql.NVarChar(80), ext)
    .query(`
      SELECT ${cols}
      FROM dbo.RecruitingCandidature
      WHERE TenantId = @tenantId AND ExternalApplicationId = @externalApplicationId
    `);
  const row = res.recordset[0];
  return row ? toCandidaturaRecord(mapCandidaturaRow(row)) : null;
}

/**
 * Candidatura già presente sulla stessa offerta con stesso contatto sicuro
 * (email valida, oppure telefono senza conflitto email).
 */
export async function findCandidaturaByContactOnOfferta(
  tenantId: string,
  offertaId: string,
  contact: { email?: string | null; phone?: string | null }
): Promise<RecruitingCandidaturaRecord | null> {
  const tid = tenantIdOrThrow(tenantId);
  const oid = idOrThrow(offertaId, "Offerta");
  const emailOk = Boolean(String(contact.email || "").trim());
  const phoneOk = Boolean(String(contact.phone || "").trim());
  if (!emailOk && !phoneOk) return null;

  const hasIndeedApply = await recruitingHasCandidatoIndeedApplyFields();
  if (!hasIndeedApply) return null;

  if (!recruitingUsesSql()) {
    const rows = await prisma.recruitingCandidatura.findMany({
      where: { tenantId: tid, offertaId: oid },
      select: await prismaCandidaturaSelect(),
      orderBy: { receivedAt: "asc" },
      take: 200,
    });
    const hit = pickContactDuplicate(
      { email: contact.email, phone: contact.phone },
      rows.map((r) => ({ id: r.id, email: r.email, phone: r.phone }))
    );
    if (!hit) return null;
    const row = rows.find((r) => r.id === hit.id);
    return row ? toCandidaturaRecord(row) : null;
  }

  const pool = await recruitingPool();
  const cols = await candidaturaSelectSql();
  const res = await pool
    .request()
    .input("tenantId", sql.NVarChar(64), tid)
    .input("offertaId", sql.NVarChar(64), oid)
    .query(`
      SELECT TOP 200 ${cols}
      FROM dbo.RecruitingCandidature
      WHERE TenantId = @tenantId AND OffertaId = @offertaId
      ORDER BY ReceivedAt ASC
    `);
  const records = res.recordset.map((r) =>
    toCandidaturaRecord(mapCandidaturaRow(r))
  );
  const hit = pickContactDuplicate(
    { email: contact.email, phone: contact.phone },
    records.map((r) => ({ id: r.id, email: r.email, phone: r.phone }))
  );
  if (!hit) return null;
  return records.find((r) => r.id === hit.id) ?? null;
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

/**
 * Upsert idempotente per candidature dal ricevitore aziendale.
 * 1) tenantId + externalApplicationId
 * 2) stessa offerta + email/telefono confrontabili (Indeed ↔ Creditplanet)
 * Aggiorna sempre LastSyncAt. Stato iniziale su create: RICEVUTA (non cambia su update).
 */
export async function upsertCandidaturaFromReceiver(
  tenantId: string,
  rawInput: RecruitingCandidaturaReceiverUpsertInput,
  createdById: string
): Promise<RecruitingCandidaturaRecord> {
  const tid = tenantIdOrThrow(tenantId);
  const authorId = String(createdById || "").trim();
  if (!authorId) throw new Error("Utente mancante");
  const input = validaCandidaturaReceiverUpsertInput(rawInput);
  const offerta = await assertOffertaDelTenant(tid, input.offertaId);

  const hasAnagrafica = await recruitingHasCandidatoAnagrafica();
  const hasIndeedApply = await recruitingHasCandidatoIndeedApplyFields();
  if (!hasIndeedApply) {
    throw new Error(
      "Colonne Indeed Apply non disponibili: applicare la migration 034"
    );
  }

  if (!recruitingUsesSql()) {
    const existing = await prisma.recruitingCandidatura.findFirst({
      where: {
        tenantId: tid,
        externalApplicationId: input.externalApplicationId,
      },
      select: await prismaCandidaturaSelect(),
    });
    if (existing) {
      if (existing.offertaId !== input.offertaId) {
        throw new Error(
          "Candidatura già sincronizzata su un'altra offerta per questa application"
        );
      }
      await prisma.recruitingCandidatura.updateMany({
        where: {
          id: existing.id,
          tenantId: tid,
          offertaId: input.offertaId,
        },
        data: {
          ...(hasAnagrafica
            ? { cognome: input.cognome, nome: input.nome }
            : {}),
          email: input.email ?? null,
          emailVerified: input.emailVerified ?? null,
          phone: input.phone ?? null,
          coverLetter: input.coverLetter ?? null,
          receiverCandidateId: input.receiverCandidateId ?? null,
          ...(input.source ? { source: input.source } : {}),
          lastSyncAt: new Date(),
        },
      });
      const updated = await getCandidatura(tid, existing.id, input.offertaId);
      if (!updated) throw new Error("Candidatura non aggiornata");
      return updated;
    }

    const byContact = await findCandidaturaByContactOnOfferta(tid, input.offertaId, {
      email: input.email,
      phone: input.phone,
    });
    if (byContact) {
      await prisma.recruitingCandidatura.updateMany({
        where: {
          id: byContact.id,
          tenantId: tid,
          offertaId: input.offertaId,
        },
        data: {
          ...(hasAnagrafica
            ? { cognome: input.cognome, nome: input.nome }
            : {}),
          // Collega external id solo se assente (non sovrascrivere un altro canale)
          ...(!byContact.externalApplicationId
            ? { externalApplicationId: input.externalApplicationId }
            : {}),
          email: input.email ?? byContact.email,
          emailVerified: input.emailVerified ?? byContact.emailVerified,
          phone: input.phone ?? byContact.phone,
          coverLetter: input.coverLetter ?? byContact.coverLetter,
          receiverCandidateId:
            input.receiverCandidateId ?? byContact.receiverCandidateId,
          ...(input.source ? { source: input.source } : {}),
          lastSyncAt: new Date(),
        },
      });
      const updated = await getCandidatura(tid, byContact.id, input.offertaId);
      if (!updated) throw new Error("Candidatura non aggiornata");
      return updated;
    }

    assertOffertaApertaPerCandidature(offerta.stato);
    const row = await prisma.$transaction(async (tx) => {
      const created = await tx.recruitingCandidatura.create({
        data: {
          tenantId: tid,
          offertaId: input.offertaId,
          externalApplicationId: input.externalApplicationId,
          receiverCandidateId: input.receiverCandidateId ?? null,
          ...(hasAnagrafica
            ? { cognome: input.cognome, nome: input.nome }
            : {}),
          email: input.email ?? null,
          emailVerified: input.emailVerified ?? null,
          phone: input.phone ?? null,
          coverLetter: input.coverLetter ?? null,
          stato: "RICEVUTA",
          source: input.source || null,
          lastSyncAt: new Date(),
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

  const pool = await recruitingPool();
  const cols = await candidaturaSelectSql();
  const found = await pool
    .request()
    .input("tenantId", sql.NVarChar(64), tid)
    .input("externalApplicationId", sql.NVarChar(80), input.externalApplicationId)
    .query(`
      SELECT ${cols}
      FROM dbo.RecruitingCandidature
      WHERE TenantId = @tenantId AND ExternalApplicationId = @externalApplicationId
    `);
  const existingRow = found.recordset[0];
  if (existingRow) {
    const existing = toCandidaturaRecord(mapCandidaturaRow(existingRow));
    if (existing.offertaId !== input.offertaId) {
      throw new Error(
        "Candidatura già sincronizzata su un'altra offerta per questa application"
      );
    }
    const upd = pool
      .request()
      .input("id", sql.NVarChar(64), existing.id)
      .input("tenantId", sql.NVarChar(64), tid)
      .input("offertaId", sql.NVarChar(64), input.offertaId)
      .input("receiverCandidateId", sql.NVarChar(80), input.receiverCandidateId ?? null)
      .input("email", sql.NVarChar(200), input.email ?? null)
      .input("emailVerified", sql.Bit, input.emailVerified)
      .input("phone", sql.NVarChar(40), input.phone ?? null)
      .input("coverLetter", sql.NVarChar(sql.MAX), input.coverLetter ?? null)
      .input("source", sql.NVarChar(80), input.source || existing.source);
    let setAnagrafica = "";
    if (hasAnagrafica) {
      upd.input("cognome", sql.NVarChar(80), input.cognome).input("nome", sql.NVarChar(80), input.nome);
      setAnagrafica = "Cognome = @cognome, Nome = @nome,";
    }
    const result = await upd.query(`
      UPDATE dbo.RecruitingCandidature
      SET
        ${setAnagrafica}
        ReceiverCandidateId = @receiverCandidateId,
        Email = @email,
        EmailVerified = @emailVerified,
        Phone = @phone,
        CoverLetter = @coverLetter,
        Source = @source,
        LastSyncAt = SYSUTCDATETIME(),
        UpdatedAt = SYSUTCDATETIME()
      WHERE Id = @id AND TenantId = @tenantId AND OffertaId = @offertaId
    `);
    if (result.rowsAffected[0] !== 1) throw new Error("Candidatura non aggiornata");
    const updated = await getCandidatura(tid, existing.id, input.offertaId);
    if (!updated) throw new Error("Candidatura non aggiornata");
    return updated;
  }

  const byContact = await findCandidaturaByContactOnOfferta(tid, input.offertaId, {
    email: input.email,
    phone: input.phone,
  });
  if (byContact) {
    const claimExternalId = !byContact.externalApplicationId;
    const upd = pool
      .request()
      .input("id", sql.NVarChar(64), byContact.id)
      .input("tenantId", sql.NVarChar(64), tid)
      .input("offertaId", sql.NVarChar(64), input.offertaId)
      .input(
        "receiverCandidateId",
        sql.NVarChar(80),
        input.receiverCandidateId ?? byContact.receiverCandidateId
      )
      .input("email", sql.NVarChar(200), input.email ?? byContact.email)
      .input(
        "emailVerified",
        sql.Bit,
        input.emailVerified ?? byContact.emailVerified
      )
      .input("phone", sql.NVarChar(40), input.phone ?? byContact.phone)
      .input(
        "coverLetter",
        sql.NVarChar(sql.MAX),
        input.coverLetter ?? byContact.coverLetter
      )
      .input("source", sql.NVarChar(80), input.source || byContact.source);
    if (claimExternalId) {
      upd.input(
        "externalApplicationId",
        sql.NVarChar(80),
        input.externalApplicationId
      );
    }
    let setAnagrafica = "";
    if (hasAnagrafica) {
      upd
        .input("cognome", sql.NVarChar(80), input.cognome)
        .input("nome", sql.NVarChar(80), input.nome);
      setAnagrafica = "Cognome = @cognome, Nome = @nome,";
    }
    const setExternal = claimExternalId
      ? "ExternalApplicationId = @externalApplicationId,"
      : "";
    const result = await upd.query(`
      UPDATE dbo.RecruitingCandidature
      SET
        ${setAnagrafica}
        ${setExternal}
        ReceiverCandidateId = @receiverCandidateId,
        Email = @email,
        EmailVerified = @emailVerified,
        Phone = @phone,
        CoverLetter = @coverLetter,
        Source = @source,
        LastSyncAt = SYSUTCDATETIME(),
        UpdatedAt = SYSUTCDATETIME()
      WHERE Id = @id AND TenantId = @tenantId AND OffertaId = @offertaId
    `);
    if (result.rowsAffected[0] !== 1) throw new Error("Candidatura non aggiornata");
    const updated = await getCandidatura(tid, byContact.id, input.offertaId);
    if (!updated) throw new Error("Candidatura non aggiornata");
    return updated;
  }

  assertOffertaApertaPerCandidature(offerta.stato);
  const id = newRecruitingId();
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    const ins = new sql.Request(tx)
      .input("id", sql.NVarChar(64), id)
      .input("tenantId", sql.NVarChar(64), tid)
      .input("offertaId", sql.NVarChar(64), input.offertaId)
      .input("externalApplicationId", sql.NVarChar(80), input.externalApplicationId)
      .input("receiverCandidateId", sql.NVarChar(80), input.receiverCandidateId ?? null)
      .input("email", sql.NVarChar(200), input.email ?? null)
      .input("emailVerified", sql.Bit, input.emailVerified)
      .input("phone", sql.NVarChar(40), input.phone ?? null)
      .input("coverLetter", sql.NVarChar(sql.MAX), input.coverLetter ?? null)
      .input("source", sql.NVarChar(80), input.source || null);
    if (hasAnagrafica) {
      ins.input("cognome", sql.NVarChar(80), input.cognome).input("nome", sql.NVarChar(80), input.nome);
      await ins.query(`
        INSERT INTO dbo.RecruitingCandidature (
          Id, TenantId, OffertaId, ExternalApplicationId, ReceiverCandidateId,
          Cognome, Nome, Email, EmailVerified, Phone, CoverLetter,
          Stato, Source, ReceivedAt, UpdatedAt, LastSyncAt
        ) VALUES (
          @id, @tenantId, @offertaId, @externalApplicationId, @receiverCandidateId,
          @cognome, @nome, @email, @emailVerified, @phone, @coverLetter,
          N'RICEVUTA', @source, SYSUTCDATETIME(), SYSUTCDATETIME(), SYSUTCDATETIME()
        )
      `);
    } else {
      await ins.query(`
        INSERT INTO dbo.RecruitingCandidature (
          Id, TenantId, OffertaId, ExternalApplicationId, ReceiverCandidateId,
          Email, EmailVerified, Phone, CoverLetter,
          Stato, Source, ReceivedAt, UpdatedAt, LastSyncAt
        ) VALUES (
          @id, @tenantId, @offertaId, @externalApplicationId, @receiverCandidateId,
          @email, @emailVerified, @phone, @coverLetter,
          N'RICEVUTA', @source, SYSUTCDATETIME(), SYSUTCDATETIME(), SYSUTCDATETIME()
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

/**
 * Allinea `Source` delle candidature arrivate dal ricevitore all'etichetta config.
 * Non tocca candidature manuali (senza ReceiverCandidateId).
 */
export async function propagateReceiverSourceName(
  tenantId: string,
  sourceName: string
): Promise<number> {
  const tid = tenantIdOrThrow(tenantId);
  const label = String(sourceName || "").trim();
  if (!label || label.length > 80) return 0;

  if (!recruitingUsesSql()) {
    const result = await prisma.recruitingCandidatura.updateMany({
      where: {
        tenantId: tid,
        NOT: { OR: [{ receiverCandidateId: null }, { receiverCandidateId: "" }] },
      },
      data: { source: label },
    });
    return result.count;
  }

  const pool = await recruitingPool();
  const result = await pool
    .request()
    .input("tenantId", sql.NVarChar(64), tid)
    .input("source", sql.NVarChar(80), label)
    .query(`
      UPDATE dbo.RecruitingCandidature
      SET Source = @source, UpdatedAt = SYSUTCDATETIME()
      WHERE TenantId = @tenantId
        AND ReceiverCandidateId IS NOT NULL
        AND LTRIM(RTRIM(ReceiverCandidateId)) <> N''
        AND ISNULL(Source, N'') <> @source
    `);
  return Number(result.rowsAffected[0] || 0);
}

/** Elimina candidatura e collegati (attività/colloqui). */
export async function deleteCandidatura(
  tenantId: string,
  candidaturaId: string
): Promise<{ id: string; offertaId: string }> {
  const tid = tenantIdOrThrow(tenantId);
  const id = idOrThrow(candidaturaId, "Candidatura");
  const existing = await getCandidatura(tid, id);
  if (!existing) throw new Error("Candidatura non trovata");

  if (!recruitingUsesSql()) {
    await prisma.recruitingCandidatura.deleteMany({
      where: { id, tenantId: tid },
    });
    return { id, offertaId: existing.offertaId };
  }

  const pool = await recruitingPool();
  const del = await pool
    .request()
    .input("id", sql.NVarChar(64), id)
    .input("tenantId", sql.NVarChar(64), tid)
    .query(`
      DELETE FROM dbo.RecruitingAttivita WHERE TenantId = @tenantId AND CandidaturaId = @id;
      DELETE FROM dbo.RecruitingColloqui WHERE TenantId = @tenantId AND CandidaturaId = @id;
      DELETE FROM dbo.RecruitingCandidature WHERE TenantId = @tenantId AND Id = @id;
    `);
  const deletedRows = Number(del.rowsAffected[2] ?? del.rowsAffected[0] ?? 0);
  if (deletedRows !== 1) throw new Error("Candidatura non eliminata");
  return { id, offertaId: existing.offertaId };
}
