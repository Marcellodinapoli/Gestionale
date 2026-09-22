import "server-only";
import { prisma } from "@/lib/prisma";
import { rolesWithPermission } from "@/lib/permissions";
import { assertCandidaturaOperabile } from "@/lib/recruiting/candidature";
import {
  assertCanCreateColloquio,
  assertTransizioneColloquio,
  toColloquioRecord,
  type EsitoColloquio,
  type ModalitaColloquio,
  type RecruitingColloquioRecord,
} from "@/lib/recruiting/colloqui";
import { assertCandidaturaDelTenant } from "@/lib/recruiting/attivitaRepo";
import {
  mapColloquioRow,
  newRecruitingId,
  recruitingPool,
  recruitingUsesSql,
  sql,
} from "@/lib/recruiting/sqlDb";

/** Solo personale con recruiting:manage (Admin / Amministrazione). */
const INTERVIEWER_ROLES = rolesWithPermission("recruiting:manage");

/** Supervisori tenant: affiancatori per la prova. */
const SUPERVISOR_ROLES = ["SUPERVISOR"] as const;

function tenantIdOrThrow(tenantId: string) {
  const id = String(tenantId || "").trim();
  if (!id) throw new Error("Tenant mancante");
  return id;
}

async function assertIntervistatoreDelTenant(tenantId: string, userId: string) {
  const uid = String(userId || "").trim();
  if (!uid) throw new Error("Intervistatore obbligatorio");
  if (!recruitingUsesSql()) {
    const user = await prisma.user.findFirst({
      where: {
        id: uid,
        tenantId,
        active: true,
        role: { in: [...INTERVIEWER_ROLES] },
      },
      select: { id: true },
    });
    if (!user) throw new Error("Intervistatore non valido");
    return;
  }
  const pool = await recruitingPool();
  const req = pool
    .request()
    .input("tenantId", sql.UniqueIdentifier, tenantId)
    .input("id", sql.UniqueIdentifier, uid);
  INTERVIEWER_ROLES.forEach((role, i) => {
    req.input(`role${i}`, sql.NVarChar(40), role);
  });
  const roleParams = INTERVIEWER_ROLES.map((_, i) => `@role${i}`).join(", ");
  const res = await req.query(`
    SELECT TOP 1 Id
    FROM dbo.Users
    WHERE Id = @id
      AND TenantId = @tenantId
      AND Active = 1
      AND Role IN (${roleParams})
  `);
  if (!res.recordset[0]) throw new Error("Intervistatore non valido");
}

async function getColloquioDelTenant(
  tenantId: string,
  id: string,
  candidaturaId?: string
): Promise<RecruitingColloquioRecord | null> {
  const tid = tenantIdOrThrow(tenantId);
  const cid = String(id || "").trim();
  if (!cid) return null;
  const oid = String(candidaturaId || "").trim();
  if (!recruitingUsesSql()) {
    const row = await prisma.recruitingColloquio.findFirst({
      where: oid
        ? { id: cid, tenantId: tid, candidaturaId: oid }
        : { id: cid, tenantId: tid },
      include: { intervistatore: { select: { name: true, cognome: true } } },
    });
    return row ? toColloquioRecord(row) : null;
  }
  const pool = await recruitingPool();
  const req = pool
    .request()
    .input("tenantId", sql.NVarChar(64), tid)
    .input("id", sql.NVarChar(64), cid);
  let q = `
    SELECT c.Id, c.TenantId, c.CandidaturaId, c.Round, c.Stato, c.ScheduledAt, c.Modalita,
           c.IntervistatoreUserId, c.IntervistatoreLabel, c.NotePreliminari, c.NoteSvolgimento,
           c.Esito, c.Valutazione, c.ValutazioneStelle, c.CreatedAt, c.UpdatedAt, c.CreatedById,
           u.Name AS IntervistatoreName, u.Cognome AS IntervistatoreCognome
    FROM dbo.RecruitingColloqui c
    LEFT JOIN dbo.Users u ON CONVERT(NVARCHAR(64), u.Id) = c.IntervistatoreUserId
    WHERE c.Id = @id AND c.TenantId = @tenantId
  `;
  if (oid) {
    req.input("candidaturaId", sql.NVarChar(64), oid);
    q += ` AND c.CandidaturaId = @candidaturaId`;
  }
  const res = await req.query(q);
  const row = res.recordset[0];
  return row ? toColloquioRecord(mapColloquioRow(row)) : null;
}

export async function listColloquiByCandidatura(
  tenantId: string,
  candidaturaId: string
): Promise<RecruitingColloquioRecord[]> {
  const candidatura = await assertCandidaturaDelTenant(tenantId, candidaturaId);
  if (!recruitingUsesSql()) {
    const rows = await prisma.recruitingColloquio.findMany({
      where: { tenantId: candidatura.tenantId, candidaturaId: candidatura.id },
      include: { intervistatore: { select: { name: true, cognome: true } } },
      orderBy: { round: "asc" },
    });
    return rows.map(toColloquioRecord);
  }
  const pool = await recruitingPool();
  const res = await pool
    .request()
    .input("tenantId", sql.NVarChar(64), candidatura.tenantId)
    .input("candidaturaId", sql.NVarChar(64), candidatura.id)
    .query(`
      SELECT c.Id, c.TenantId, c.CandidaturaId, c.Round, c.Stato, c.ScheduledAt, c.Modalita,
             c.IntervistatoreUserId, c.IntervistatoreLabel, c.NotePreliminari, c.NoteSvolgimento,
             c.Esito, c.Valutazione, c.ValutazioneStelle, c.CreatedAt, c.UpdatedAt, c.CreatedById,
             u.Name AS IntervistatoreName, u.Cognome AS IntervistatoreCognome
      FROM dbo.RecruitingColloqui c
      LEFT JOIN dbo.Users u ON CONVERT(NVARCHAR(64), u.Id) = c.IntervistatoreUserId
      WHERE c.TenantId = @tenantId AND c.CandidaturaId = @candidaturaId
      ORDER BY c.Round ASC
    `);
  return res.recordset.map((r) => toColloquioRecord(mapColloquioRow(r)));
}

export async function listColloquiRecenti(
  tenantId: string,
  limit = 30
): Promise<
  Array<
    RecruitingColloquioRecord & {
      offertaId: string;
      offertaTitolo: string;
    }
  >
> {
  const tid = tenantIdOrThrow(tenantId);
  const take = Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 100) : 30;
  if (!recruitingUsesSql()) {
    const rows = await prisma.recruitingColloquio.findMany({
      where: { tenantId: tid },
      orderBy: { scheduledAt: "desc" },
      take,
      include: {
        intervistatore: { select: { name: true, cognome: true } },
        candidatura: {
          select: {
            id: true,
            offertaId: true,
            offerta: { select: { titolo: true } },
          },
        },
      },
    });
    return rows.map((row) => ({
      ...toColloquioRecord(row),
      offertaId: row.candidatura.offertaId,
      offertaTitolo: row.candidatura.offerta?.titolo || "",
    }));
  }
  const pool = await recruitingPool();
  const res = await pool
    .request()
    .input("tenantId", sql.NVarChar(64), tid)
    .input("take", sql.Int, take)
    .query(`
      SELECT TOP (@take)
        c.Id, c.TenantId, c.CandidaturaId, c.Round, c.Stato, c.ScheduledAt, c.Modalita,
        c.IntervistatoreUserId, c.IntervistatoreLabel, c.NotePreliminari, c.NoteSvolgimento,
        c.Esito, c.Valutazione, c.ValutazioneStelle, c.CreatedAt, c.UpdatedAt, c.CreatedById,
        u.Name AS IntervistatoreName, u.Cognome AS IntervistatoreCognome,
        cand.OffertaId AS OffertaId, o.Titolo AS OffertaTitolo
      FROM dbo.RecruitingColloqui c
      INNER JOIN dbo.RecruitingCandidature cand ON cand.Id = c.CandidaturaId AND cand.TenantId = c.TenantId
      INNER JOIN dbo.OfferteLavoro o ON o.Id = cand.OffertaId AND o.TenantId = c.TenantId
      LEFT JOIN dbo.Users u ON CONVERT(NVARCHAR(64), u.Id) = c.IntervistatoreUserId
      WHERE c.TenantId = @tenantId
      ORDER BY c.ScheduledAt DESC
    `);
  return res.recordset.map((row) => ({
    ...toColloquioRecord(mapColloquioRow(row)),
    offertaId: String(row.OffertaId),
    offertaTitolo: String(row.OffertaTitolo || ""),
  }));
}

export async function listUtentiTenantRecruiting(
  tenantId: string
): Promise<Array<{ id: string; name: string }>> {
  const tid = tenantIdOrThrow(tenantId);
  if (!recruitingUsesSql()) {
    const rows = await prisma.user.findMany({
      where: {
        tenantId: tid,
        active: true,
        role: { in: [...INTERVIEWER_ROLES] },
      },
      select: { id: true, name: true, cognome: true },
      orderBy: { name: "asc" },
    });
    return rows.map((u) => ({
      id: u.id,
      name: [u.name, u.cognome].filter(Boolean).join(" ").trim() || u.name,
    }));
  }
  const pool = await recruitingPool();
  const req = pool.request().input("tenantId", sql.UniqueIdentifier, tid);
  INTERVIEWER_ROLES.forEach((role, i) => {
    req.input(`role${i}`, sql.NVarChar(40), role);
  });
  const roleParams = INTERVIEWER_ROLES.map((_, i) => `@role${i}`).join(", ");
  const res = await req.query(`
    SELECT CONVERT(NVARCHAR(64), Id) AS Id, Name, Cognome
    FROM dbo.Users
    WHERE TenantId = @tenantId
      AND Active = 1
      AND Role IN (${roleParams})
    ORDER BY Name ASC
  `);
  return res.recordset.map((u) => ({
    id: String(u.Id),
    name: [u.Name, u.Cognome].filter(Boolean).join(" ").trim() || String(u.Name),
  }));
}

/** Lista supervisori attivi del tenant (affiancatori prova). */
export async function listSupervisoriTenantRecruiting(
  tenantId: string
): Promise<Array<{ id: string; name: string }>> {
  const tid = tenantIdOrThrow(tenantId);
  if (!recruitingUsesSql()) {
    const rows = await prisma.user.findMany({
      where: {
        tenantId: tid,
        active: true,
        role: { in: [...SUPERVISOR_ROLES] },
      },
      select: { id: true, name: true, cognome: true },
      orderBy: { name: "asc" },
    });
    return rows.map((u) => ({
      id: u.id,
      name: [u.name, u.cognome].filter(Boolean).join(" ").trim() || u.name,
    }));
  }
  const pool = await recruitingPool();
  const req = pool.request().input("tenantId", sql.UniqueIdentifier, tid);
  SUPERVISOR_ROLES.forEach((role, i) => {
    req.input(`role${i}`, sql.NVarChar(40), role);
  });
  const roleParams = SUPERVISOR_ROLES.map((_, i) => `@role${i}`).join(", ");
  const res = await req.query(`
    SELECT CONVERT(NVARCHAR(64), Id) AS Id, Name, Cognome
    FROM dbo.Users
    WHERE TenantId = @tenantId
      AND Active = 1
      AND Role IN (${roleParams})
    ORDER BY Name ASC
  `);
  return res.recordset.map((u) => ({
    id: String(u.Id),
    name: [u.Name, u.Cognome].filter(Boolean).join(" ").trim() || String(u.Name),
  }));
}

export async function createColloquio(
  tenantId: string,
  createdById: string,
  input: {
    candidaturaId: string;
    scheduledAt: Date;
    modalita: ModalitaColloquio;
    intervistatoreUserId: string;
    intervistatoreLabel: string;
    notePreliminari: string;
  }
): Promise<RecruitingColloquioRecord> {
  const candidatura = await assertCandidaturaDelTenant(tenantId, input.candidaturaId);
  assertCandidaturaOperabile(candidatura.stato);
  assertCanCreateColloquio(candidatura.stato);
  await assertIntervistatoreDelTenant(candidatura.tenantId, input.intervistatoreUserId);

  if (!recruitingUsesSql()) {
    const last = await prisma.recruitingColloquio.findFirst({
      where: { tenantId: candidatura.tenantId, candidaturaId: candidatura.id },
      orderBy: { round: "desc" },
      select: { round: true },
    });
    const round = (last?.round || 0) + 1;
    const created = await prisma.$transaction(async (tx) => {
      const row = await tx.recruitingColloquio.create({
        data: {
          tenantId: candidatura.tenantId,
          candidaturaId: candidatura.id,
          round,
          stato: "PROGRAMMATO",
          scheduledAt: input.scheduledAt,
          modalita: input.modalita,
          intervistatoreUserId: input.intervistatoreUserId || null,
          intervistatoreLabel: input.intervistatoreLabel,
          notePreliminari: input.notePreliminari,
          createdById,
        },
        include: { intervistatore: { select: { name: true, cognome: true } } },
      });
      await tx.recruitingAttivita.create({
        data: {
          tenantId: candidatura.tenantId,
          candidaturaId: candidatura.id,
          tipo: "COLLOQUIO_PROGRAMMATO",
          occurredAt: input.scheduledAt,
          note: input.notePreliminari,
          colloquioId: row.id,
          createdById,
        },
      });
      return row;
    });
    return toColloquioRecord(created);
  }

  const pool = await recruitingPool();
  const lastRes = await pool
    .request()
    .input("tenantId", sql.NVarChar(64), candidatura.tenantId)
    .input("candidaturaId", sql.NVarChar(64), candidatura.id)
    .query(`
      SELECT TOP 1 Round FROM dbo.RecruitingColloqui
      WHERE TenantId = @tenantId AND CandidaturaId = @candidaturaId
      ORDER BY Round DESC
    `);
  const round = Number(lastRes.recordset[0]?.Round || 0) + 1;
  const id = newRecruitingId();
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    await new sql.Request(tx)
      .input("id", sql.NVarChar(64), id)
      .input("tenantId", sql.NVarChar(64), candidatura.tenantId)
      .input("candidaturaId", sql.NVarChar(64), candidatura.id)
      .input("round", sql.Int, round)
      .input("scheduledAt", sql.DateTime2, input.scheduledAt)
      .input("modalita", sql.NVarChar(20), input.modalita)
      .input("intUser", sql.NVarChar(64), input.intervistatoreUserId || null)
      .input("intLabel", sql.NVarChar(120), input.intervistatoreLabel)
      .input("notePre", sql.NVarChar(2000), input.notePreliminari)
      .input("createdById", sql.NVarChar(64), createdById)
      .query(`
        INSERT INTO dbo.RecruitingColloqui (
          Id, TenantId, CandidaturaId, Round, Stato, ScheduledAt, Modalita,
          IntervistatoreUserId, IntervistatoreLabel, NotePreliminari, NoteSvolgimento,
          Esito, Valutazione, CreatedAt, UpdatedAt, CreatedById
        ) VALUES (
          @id, @tenantId, @candidaturaId, @round, N'PROGRAMMATO', @scheduledAt, @modalita,
          @intUser, @intLabel, @notePre, N'', NULL, N'',
          SYSUTCDATETIME(), SYSUTCDATETIME(), @createdById
        )
      `);
    await new sql.Request(tx)
      .input("aid", sql.NVarChar(64), newRecruitingId())
      .input("tenantId", sql.NVarChar(64), candidatura.tenantId)
      .input("candidaturaId", sql.NVarChar(64), candidatura.id)
      .input("occurredAt", sql.DateTime2, input.scheduledAt)
      .input("note", sql.NVarChar(2000), input.notePreliminari)
      .input("colloquioId", sql.NVarChar(64), id)
      .input("createdById", sql.NVarChar(64), createdById)
      .query(`
        INSERT INTO dbo.RecruitingAttivita (
          Id, TenantId, CandidaturaId, Tipo, OccurredAt, Note, Esito,
          StatoDa, StatoA, ColloquioId, Canale, CreatedAt, CreatedById
        ) VALUES (
          @aid, @tenantId, @candidaturaId, N'COLLOQUIO_PROGRAMMATO', @occurredAt, @note, NULL,
          NULL, NULL, @colloquioId, NULL, SYSUTCDATETIME(), @createdById
        )
      `);
    await tx.commit();
  } catch (e) {
    await tx.rollback();
    throw e;
  }
  const created = await getColloquioDelTenant(candidatura.tenantId, id, candidatura.id);
  if (!created) throw new Error("Colloquio non creato");
  return created;
}

async function transizioneColloquio(input: {
  tenantId: string;
  createdById: string;
  id: string;
  to: "SVOLTO" | "ESITATO" | "ANNULLATO";
  noteSvolgimento?: string;
  esito?: EsitoColloquio;
  valutazione?: string;
  valutazioneStelle?: number | null;
}): Promise<RecruitingColloquioRecord> {
  const current = await getColloquioDelTenant(input.tenantId, input.id);
  if (!current) throw new Error("Colloquio non trovato");
  const candidatura = await assertCandidaturaDelTenant(input.tenantId, current.candidaturaId);
  if (current.tenantId !== candidatura.tenantId) throw new Error("Colloquio non trovato");
  assertCandidaturaOperabile(candidatura.stato);
  assertTransizioneColloquio(current.stato, input.to);

  if (!recruitingUsesSql()) {
    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.recruitingColloquio.updateMany({
        where: {
          id: current.id,
          tenantId: candidatura.tenantId,
          candidaturaId: candidatura.id,
          stato: current.stato,
        },
        data: {
          stato: input.to,
          ...(input.noteSvolgimento !== undefined ? { noteSvolgimento: input.noteSvolgimento } : {}),
          ...(input.esito ? { esito: input.esito } : {}),
          ...(input.valutazione !== undefined ? { valutazione: input.valutazione } : {}),
          ...(input.valutazioneStelle !== undefined
            ? { valutazioneStelle: input.valutazioneStelle }
            : {}),
        },
      });
      if (result.count !== 1) throw new Error("Colloquio non trovato");
      const tipo =
        input.to === "SVOLTO"
          ? "COLLOQUIO_SVOLTO"
          : input.to === "ESITATO"
            ? "COLLOQUIO_ESITO"
            : "COLLOQUIO_ANNULLATO";
      const stelleNote =
        input.to === "SVOLTO" && input.valutazioneStelle
          ? `Valutazione: ${input.valutazioneStelle}/5`
          : "";
      await tx.recruitingAttivita.create({
        data: {
          tenantId: candidatura.tenantId,
          candidaturaId: candidatura.id,
          tipo,
          occurredAt: new Date(),
          note:
            input.to === "SVOLTO"
              ? [stelleNote, input.noteSvolgimento || ""].filter(Boolean).join(" · ")
              : input.to === "ESITATO"
                ? input.valutazione || ""
                : "",
          esito: input.esito || null,
          colloquioId: current.id,
          createdById: input.createdById,
        },
      });
      const row = await tx.recruitingColloquio.findFirst({
        where: { id: current.id, tenantId: candidatura.tenantId, candidaturaId: candidatura.id },
        include: { intervistatore: { select: { name: true, cognome: true } } },
      });
      if (!row) throw new Error("Colloquio non trovato");
      return row;
    });
    return toColloquioRecord(updated);
  }

  const tipo =
    input.to === "SVOLTO"
      ? "COLLOQUIO_SVOLTO"
      : input.to === "ESITATO"
        ? "COLLOQUIO_ESITO"
        : "COLLOQUIO_ANNULLATO";
  const stelleNote =
    input.to === "SVOLTO" && input.valutazioneStelle
      ? `Valutazione: ${input.valutazioneStelle}/5`
      : "";
  const note =
    input.to === "SVOLTO"
      ? [stelleNote, input.noteSvolgimento || ""].filter(Boolean).join(" · ")
      : input.to === "ESITATO"
        ? input.valutazione || ""
        : "";

  const pool = await recruitingPool();
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    const upd = await new sql.Request(tx)
      .input("id", sql.NVarChar(64), current.id)
      .input("tenantId", sql.NVarChar(64), candidatura.tenantId)
      .input("candidaturaId", sql.NVarChar(64), candidatura.id)
      .input("fromStato", sql.NVarChar(30), current.stato)
      .input("toStato", sql.NVarChar(30), input.to)
      .input("noteSvo", sql.NVarChar(2000), input.noteSvolgimento ?? null)
      .input("esito", sql.NVarChar(30), input.esito ?? null)
      .input("val", sql.NVarChar(2000), input.valutazione ?? null)
      .input("stelle", sql.Int, input.valutazioneStelle ?? null)
      .query(`
        UPDATE dbo.RecruitingColloqui SET
          Stato = @toStato,
          NoteSvolgimento = COALESCE(@noteSvo, NoteSvolgimento),
          Esito = COALESCE(@esito, Esito),
          Valutazione = COALESCE(@val, Valutazione),
          ValutazioneStelle = COALESCE(@stelle, ValutazioneStelle),
          UpdatedAt = SYSUTCDATETIME()
        WHERE Id = @id AND TenantId = @tenantId AND CandidaturaId = @candidaturaId AND Stato = @fromStato
      `);
    if (upd.rowsAffected[0] !== 1) throw new Error("Colloquio non trovato");
    await new sql.Request(tx)
      .input("aid", sql.NVarChar(64), newRecruitingId())
      .input("tenantId", sql.NVarChar(64), candidatura.tenantId)
      .input("candidaturaId", sql.NVarChar(64), candidatura.id)
      .input("tipo", sql.NVarChar(40), tipo)
      .input("note", sql.NVarChar(2000), note)
      .input("esito", sql.NVarChar(30), input.esito ?? null)
      .input("colloquioId", sql.NVarChar(64), current.id)
      .input("createdById", sql.NVarChar(64), input.createdById)
      .query(`
        INSERT INTO dbo.RecruitingAttivita (
          Id, TenantId, CandidaturaId, Tipo, OccurredAt, Note, Esito,
          StatoDa, StatoA, ColloquioId, Canale, CreatedAt, CreatedById
        ) VALUES (
          @aid, @tenantId, @candidaturaId, @tipo, SYSUTCDATETIME(), @note, @esito,
          NULL, NULL, @colloquioId, NULL, SYSUTCDATETIME(), @createdById
        )
      `);
    await tx.commit();
  } catch (e) {
    await tx.rollback();
    throw e;
  }
  const updated = await getColloquioDelTenant(candidatura.tenantId, current.id, candidatura.id);
  if (!updated) throw new Error("Colloquio non trovato");
  return updated;
}

export async function svolgiColloquio(
  tenantId: string,
  createdById: string,
  input: { id: string; noteSvolgimento: string; valutazioneStelle: number | null }
): Promise<RecruitingColloquioRecord> {
  return transizioneColloquio({
    tenantId,
    createdById,
    id: input.id,
    to: "SVOLTO",
    noteSvolgimento: input.noteSvolgimento,
    valutazioneStelle: input.valutazioneStelle,
  });
}

export async function chiudiColloquio(
  tenantId: string,
  createdById: string,
  input: { id: string; esito: EsitoColloquio; valutazione: string }
): Promise<RecruitingColloquioRecord> {
  return transizioneColloquio({
    tenantId,
    createdById,
    id: input.id,
    to: "ESITATO",
    esito: input.esito,
    valutazione: input.valutazione,
  });
}

/** Segna svolto (se ancora PROGRAMMATO) e registra subito l'esito in un unico passaggio. */
export async function svolgiEChiudiColloquio(
  tenantId: string,
  createdById: string,
  input: {
    id: string;
    noteSvolgimento: string;
    valutazioneStelle: number | null;
    esito: EsitoColloquio;
    valutazione: string;
  }
): Promise<RecruitingColloquioRecord> {
  const current = await getColloquioDelTenant(tenantId, input.id);
  if (!current) throw new Error("Colloquio non trovato");
  if (current.stato === "PROGRAMMATO") {
    await svolgiColloquio(tenantId, createdById, {
      id: input.id,
      noteSvolgimento: input.noteSvolgimento,
      valutazioneStelle: input.valutazioneStelle,
    });
  } else if (current.stato !== "SVOLTO") {
    throw new Error("Colloquio non in stato idoneo per la valutazione");
  }
  return transizioneColloquio({
    tenantId,
    createdById,
    id: input.id,
    to: "ESITATO",
    esito: input.esito,
    valutazione: input.valutazione,
    noteSvolgimento: input.noteSvolgimento,
    valutazioneStelle: input.valutazioneStelle,
  });
}

/** Aggiorna esito/note/stelle di un colloquio non annullato. */
export async function patchValutazioneColloquio(
  tenantId: string,
  input: {
    id: string;
    notePreliminari: string;
    noteSvolgimento: string;
    esito: EsitoColloquio;
    valutazione: string;
    valutazioneStelle: number | null;
  }
): Promise<RecruitingColloquioRecord> {
  const current = await getColloquioDelTenant(tenantId, input.id);
  if (!current) throw new Error("Colloquio non trovato");
  if (current.stato === "ANNULLATO") {
    throw new Error("Colloquio annullato non modificabile");
  }
  const candidatura = await assertCandidaturaDelTenant(tenantId, current.candidaturaId);
  assertCandidaturaOperabile(candidatura.stato);

  if (!recruitingUsesSql()) {
    const result = await prisma.recruitingColloquio.updateMany({
      where: {
        id: current.id,
        tenantId: candidatura.tenantId,
        candidaturaId: candidatura.id,
        stato: { not: "ANNULLATO" },
      },
      data: {
        notePreliminari: input.notePreliminari,
        noteSvolgimento: input.noteSvolgimento,
        esito: input.esito,
        valutazione: input.valutazione,
        valutazioneStelle: input.valutazioneStelle,
      },
    });
    if (result.count !== 1) throw new Error("Colloquio non trovato");
    const updated = await getColloquioDelTenant(candidatura.tenantId, current.id, candidatura.id);
    if (!updated) throw new Error("Colloquio non trovato");
    return updated;
  }

  const pool = await recruitingPool();
  const result = await pool
    .request()
    .input("id", sql.NVarChar(64), current.id)
    .input("tenantId", sql.NVarChar(64), candidatura.tenantId)
    .input("candidaturaId", sql.NVarChar(64), candidatura.id)
    .input("notePre", sql.NVarChar(2000), input.notePreliminari)
    .input("noteSvo", sql.NVarChar(2000), input.noteSvolgimento)
    .input("esito", sql.NVarChar(30), input.esito)
    .input("val", sql.NVarChar(2000), input.valutazione)
    .input("stelle", sql.Int, input.valutazioneStelle)
    .query(`
      UPDATE dbo.RecruitingColloqui SET
        NotePreliminari = @notePre,
        NoteSvolgimento = @noteSvo,
        Esito = @esito,
        Valutazione = @val,
        ValutazioneStelle = @stelle,
        UpdatedAt = SYSUTCDATETIME()
      WHERE Id = @id AND TenantId = @tenantId AND CandidaturaId = @candidaturaId AND Stato <> N'ANNULLATO'
    `);
  if (result.rowsAffected[0] !== 1) throw new Error("Colloquio non trovato");
  const updated = await getColloquioDelTenant(candidatura.tenantId, current.id, candidatura.id);
  if (!updated) throw new Error("Colloquio non trovato");
  return updated;
}

/** Salva valutazione: chiude PROGRAMMATO/SVOLTO oppure aggiorna un ESITATO. */
export async function salvaValutazioneColloquio(
  tenantId: string,
  createdById: string,
  input: {
    id: string;
    notePreliminari: string;
    noteSvolgimento: string;
    valutazioneStelle: number | null;
    esito: EsitoColloquio;
    valutazione: string;
  }
): Promise<RecruitingColloquioRecord> {
  const current = await getColloquioDelTenant(tenantId, input.id);
  if (!current) throw new Error("Colloquio non trovato");
  if (current.stato === "ANNULLATO") {
    throw new Error("Colloquio annullato non modificabile");
  }
  if (current.stato === "PROGRAMMATO" || current.stato === "SVOLTO") {
    await svolgiEChiudiColloquio(tenantId, createdById, {
      id: input.id,
      noteSvolgimento: input.noteSvolgimento,
      valutazioneStelle: input.valutazioneStelle,
      esito: input.esito,
      valutazione: input.valutazione,
    });
  }
  return patchValutazioneColloquio(tenantId, input);
}

export async function annullaColloquio(
  tenantId: string,
  createdById: string,
  id: string
): Promise<RecruitingColloquioRecord> {
  return transizioneColloquio({
    tenantId,
    createdById,
    id,
    to: "ANNULLATO",
  });
}

/** Aggiorna data/modalità/referente/note di un colloquio ancora PROGRAMMATO. */
export async function updateColloquio(
  tenantId: string,
  createdById: string,
  input: {
    id: string;
    scheduledAt: Date;
    modalita: ModalitaColloquio;
    intervistatoreUserId: string;
    intervistatoreLabel: string;
    notePreliminari: string;
  }
): Promise<RecruitingColloquioRecord> {
  const current = await getColloquioDelTenant(tenantId, input.id);
  if (!current) throw new Error("Colloquio non trovato");
  if (current.stato !== "PROGRAMMATO") {
    throw new Error("Si possono modificare solo i colloqui programmati");
  }
  const candidatura = await assertCandidaturaDelTenant(tenantId, current.candidaturaId);
  assertCandidaturaOperabile(candidatura.stato);
  await assertIntervistatoreDelTenant(candidatura.tenantId, input.intervistatoreUserId);

  if (!recruitingUsesSql()) {
    const result = await prisma.recruitingColloquio.updateMany({
      where: {
        id: current.id,
        tenantId: candidatura.tenantId,
        candidaturaId: candidatura.id,
        stato: "PROGRAMMATO",
      },
      data: {
        scheduledAt: input.scheduledAt,
        modalita: input.modalita,
        intervistatoreUserId: input.intervistatoreUserId || null,
        intervistatoreLabel: input.intervistatoreLabel,
        notePreliminari: input.notePreliminari,
      },
    });
    if (result.count !== 1) throw new Error("Colloquio non trovato");
    const updated = await getColloquioDelTenant(candidatura.tenantId, current.id, candidatura.id);
    if (!updated) throw new Error("Colloquio non trovato");
    return updated;
  }

  const pool = await recruitingPool();
  const result = await pool
    .request()
    .input("id", sql.NVarChar(64), current.id)
    .input("tenantId", sql.NVarChar(64), candidatura.tenantId)
    .input("candidaturaId", sql.NVarChar(64), candidatura.id)
    .input("scheduledAt", sql.DateTime2, input.scheduledAt)
    .input("modalita", sql.NVarChar(20), input.modalita)
    .input("intUser", sql.NVarChar(64), input.intervistatoreUserId || null)
    .input("intLabel", sql.NVarChar(120), input.intervistatoreLabel)
    .input("notePre", sql.NVarChar(2000), input.notePreliminari)
    .query(`
      UPDATE dbo.RecruitingColloqui SET
        ScheduledAt = @scheduledAt,
        Modalita = @modalita,
        IntervistatoreUserId = @intUser,
        IntervistatoreLabel = @intLabel,
        NotePreliminari = @notePre,
        UpdatedAt = SYSUTCDATETIME()
      WHERE Id = @id AND TenantId = @tenantId AND CandidaturaId = @candidaturaId AND Stato = N'PROGRAMMATO'
    `);
  if (result.rowsAffected[0] !== 1) throw new Error("Colloquio non trovato");
  void createdById;
  const updated = await getColloquioDelTenant(candidatura.tenantId, current.id, candidatura.id);
  if (!updated) throw new Error("Colloquio non trovato");
  return updated;
}

/** Elimina un colloquio PROGRAMMATO o ANNULLATO (non se già svolto/esitato). */
export async function deleteColloquio(
  tenantId: string,
  id: string
): Promise<{ candidaturaId: string }> {
  const current = await getColloquioDelTenant(tenantId, id);
  if (!current) throw new Error("Colloquio non trovato");
  if (current.stato !== "PROGRAMMATO" && current.stato !== "ANNULLATO") {
    throw new Error("Si possono eliminare solo colloqui programmati o annullati");
  }
  const candidatura = await assertCandidaturaDelTenant(tenantId, current.candidaturaId);
  assertCandidaturaOperabile(candidatura.stato);

  if (!recruitingUsesSql()) {
    await prisma.$transaction(async (tx) => {
      await tx.recruitingAttivita.deleteMany({
        where: {
          tenantId: candidatura.tenantId,
          candidaturaId: candidatura.id,
          colloquioId: current.id,
        },
      });
      const result = await tx.recruitingColloquio.deleteMany({
        where: {
          id: current.id,
          tenantId: candidatura.tenantId,
          candidaturaId: candidatura.id,
          stato: { in: ["PROGRAMMATO", "ANNULLATO"] },
        },
      });
      if (result.count !== 1) throw new Error("Colloquio non trovato");
    });
    return { candidaturaId: candidatura.id };
  }

  const pool = await recruitingPool();
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    await new sql.Request(tx)
      .input("tenantId", sql.NVarChar(64), candidatura.tenantId)
      .input("candidaturaId", sql.NVarChar(64), candidatura.id)
      .input("colloquioId", sql.NVarChar(64), current.id)
      .query(`
        DELETE FROM dbo.RecruitingAttivita
        WHERE TenantId = @tenantId AND CandidaturaId = @candidaturaId AND ColloquioId = @colloquioId
      `);
    const del = await new sql.Request(tx)
      .input("id", sql.NVarChar(64), current.id)
      .input("tenantId", sql.NVarChar(64), candidatura.tenantId)
      .input("candidaturaId", sql.NVarChar(64), candidatura.id)
      .query(`
        DELETE FROM dbo.RecruitingColloqui
        WHERE Id = @id AND TenantId = @tenantId AND CandidaturaId = @candidaturaId
          AND Stato IN (N'PROGRAMMATO', N'ANNULLATO')
      `);
    if (del.rowsAffected[0] !== 1) throw new Error("Colloquio non trovato");
    await tx.commit();
  } catch (e) {
    await tx.rollback();
    throw e;
  }
  return { candidaturaId: candidatura.id };
}
