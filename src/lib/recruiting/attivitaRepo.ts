import "server-only";
import { prisma } from "@/lib/prisma";
import { getCandidatura } from "@/lib/recruiting/candidatureRepo";
import { getOffertaLavoro } from "@/lib/recruiting/offerteRepo";
import {
  assertCandidaturaOperabile,
  type RecruitingCandidaturaRecord,
} from "@/lib/recruiting/candidature";
import {
  encodeProvaEsitoNote,
  toAttivitaRecord,
  type CanaleContatto,
  type EsitoContatto,
  type RecruitingAttivitaRecord,
  type TipoAttivita,
} from "@/lib/recruiting/attivita";
import {
  mapAttivitaRow,
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

function idOrThrow(id: string, label: string) {
  const value = String(id || "").trim();
  if (!value || value.length > 80) throw new Error(`${label} non indicata`);
  return value;
}

export async function assertCandidaturaDelTenant(
  tenantId: string,
  candidaturaId: string
): Promise<RecruitingCandidaturaRecord> {
  const tid = tenantIdOrThrow(tenantId);
  const cid = idOrThrow(candidaturaId, "Candidatura");
  const candidatura = await getCandidatura(tid, cid);
  if (!candidatura || candidatura.tenantId !== tid) {
    throw new Error("Candidatura non trovata");
  }
  const offerta = await getOffertaLavoro(tid, candidatura.offertaId);
  if (!offerta || offerta.tenantId !== tid) {
    throw new Error("Offerta non trovata");
  }
  return candidatura;
}

export async function listAttivitaByCandidatura(
  tenantId: string,
  candidaturaId: string
): Promise<RecruitingAttivitaRecord[]> {
  const candidatura = await assertCandidaturaDelTenant(tenantId, candidaturaId);
  if (!recruitingUsesSql()) {
    const rows = await prisma.recruitingAttivita.findMany({
      where: { tenantId: candidatura.tenantId, candidaturaId: candidatura.id },
      include: { createdBy: { select: { name: true, cognome: true } } },
      orderBy: { occurredAt: "asc" },
    });
    return rows.map(toAttivitaRecord);
  }
  const pool = await recruitingPool();
  const res = await pool
    .request()
    .input("tenantId", sql.NVarChar(64), candidatura.tenantId)
    .input("candidaturaId", sql.NVarChar(64), candidatura.id)
    .query(`
      SELECT a.Id, a.TenantId, a.CandidaturaId, a.Tipo, a.OccurredAt, a.Note, a.Esito,
             a.StatoDa, a.StatoA, a.ColloquioId, a.Canale, a.CreatedAt, a.CreatedById,
             u.Name AS CreatedByName, u.Cognome AS CreatedByCognome
      FROM dbo.RecruitingAttivita a
      LEFT JOIN dbo.Users u ON CONVERT(NVARCHAR(64), u.Id) = a.CreatedById
      WHERE a.TenantId = @tenantId AND a.CandidaturaId = @candidaturaId
      ORDER BY a.OccurredAt ASC
    `);
  return res.recordset.map((r) => toAttivitaRecord(mapAttivitaRow(r)));
}

async function insertAttivita(input: {
  tenantId: string;
  candidaturaId: string;
  tipo: TipoAttivita;
  occurredAt: Date;
  createdById: string;
  note?: string;
  esito?: string | null;
  statoDa?: string | null;
  statoA?: string | null;
  colloquioId?: string | null;
  canale?: CanaleContatto | null;
}): Promise<RecruitingAttivitaRecord> {
  if (!recruitingUsesSql()) {
    const row = await prisma.recruitingAttivita.create({
      data: {
        tenantId: input.tenantId,
        candidaturaId: input.candidaturaId,
        tipo: input.tipo,
        occurredAt: input.occurredAt,
        note: input.note || "",
        esito: input.esito || null,
        statoDa: input.statoDa || null,
        statoA: input.statoA || null,
        colloquioId: input.colloquioId || null,
        canale: input.canale || null,
        createdById: input.createdById,
      },
      include: { createdBy: { select: { name: true, cognome: true } } },
    });
    return toAttivitaRecord(row);
  }
  const id = newRecruitingId();
  const pool = await recruitingPool();
  await pool
    .request()
    .input("id", sql.NVarChar(64), id)
    .input("tenantId", sql.NVarChar(64), input.tenantId)
    .input("candidaturaId", sql.NVarChar(64), input.candidaturaId)
    .input("tipo", sql.NVarChar(40), input.tipo)
    .input("occurredAt", sql.DateTime2, input.occurredAt)
    .input("note", sql.NVarChar(2000), input.note || "")
    .input("esito", sql.NVarChar(30), input.esito ?? null)
    .input("statoDa", sql.NVarChar(30), input.statoDa ?? null)
    .input("statoA", sql.NVarChar(30), input.statoA ?? null)
    .input("colloquioId", sql.NVarChar(64), input.colloquioId ?? null)
    .input("canale", sql.NVarChar(20), input.canale ?? null)
    .input("createdById", sql.NVarChar(64), input.createdById)
    .query(`
      INSERT INTO dbo.RecruitingAttivita (
        Id, TenantId, CandidaturaId, Tipo, OccurredAt, Note, Esito,
        StatoDa, StatoA, ColloquioId, Canale, CreatedAt, CreatedById
      ) VALUES (
        @id, @tenantId, @candidaturaId, @tipo, @occurredAt, @note, @esito,
        @statoDa, @statoA, @colloquioId, @canale, SYSUTCDATETIME(), @createdById
      )
    `);
  const list = await listAttivitaByCandidatura(input.tenantId, input.candidaturaId);
  const created = list.find((a) => a.id === id);
  if (!created) throw new Error("Attività non creata");
  return created;
}

export async function createContattoAttivita(
  tenantId: string,
  createdById: string,
  input: {
    candidaturaId: string;
    canale: CanaleContatto;
    esito: EsitoContatto;
    occurredAt: Date;
    note: string;
  }
): Promise<RecruitingAttivitaRecord> {
  const candidatura = await assertCandidaturaDelTenant(tenantId, input.candidaturaId);
  assertCandidaturaOperabile(candidatura.stato);
  if (candidatura.stato === "ASSUNTA" || candidatura.stato === "ARCHIVIATA") {
    throw new Error("Candidatura non modificabile");
  }
  if (
    candidatura.stato !== "RICEVUTA" &&
    candidatura.stato !== "IN_VALUTAZIONE" &&
    candidatura.stato !== "COLLOQUIO"
  ) {
    throw new Error("Il contatto si registra solo in Candidatura o Colloquio");
  }
  return insertAttivita({
    tenantId: candidatura.tenantId,
    candidaturaId: candidatura.id,
    tipo: "CONTATTO",
    occurredAt: input.occurredAt,
    createdById,
    note: input.note,
    esito: input.esito,
    canale: input.canale,
    statoA: candidatura.stato,
  });
}

export async function createNotaAttivita(
  tenantId: string,
  createdById: string,
  input: { candidaturaId: string; occurredAt: Date; note: string }
): Promise<RecruitingAttivitaRecord> {
  const candidatura = await assertCandidaturaDelTenant(tenantId, input.candidaturaId);
  assertCandidaturaOperabile(candidatura.stato);
  return insertAttivita({
    tenantId: candidatura.tenantId,
    candidaturaId: candidatura.id,
    tipo: "NOTA",
    occurredAt: input.occurredAt,
    createdById,
    note: input.note,
    statoA: candidatura.stato,
  });
}

export async function createProvaProgrammata(
  tenantId: string,
  createdById: string,
  input: {
    candidaturaId: string;
    scheduledAt: Date;
    note: string;
    modalita?: string;
    intervistatoreLabel?: string;
  }
): Promise<RecruitingAttivitaRecord> {
  const candidatura = await assertCandidaturaDelTenant(tenantId, input.candidaturaId);
  assertCandidaturaOperabile(candidatura.stato);
  if (candidatura.stato !== "COLLOQUIO") {
    throw new Error("Prova non programmabile in questo stato");
  }
  const modalitaLabels: Record<string, string> = {
    PRESENZA: "In presenza",
    VIDEO: "Video",
    TELEFONO: "Telefono",
  };
  const meta: string[] = [];
  if (input.modalita) {
    meta.push(`Modalità: ${modalitaLabels[input.modalita] || input.modalita}`);
  }
  if (input.intervistatoreLabel) {
    meta.push(`Affiancatore: ${input.intervistatoreLabel}`);
  }
  const note = [meta.join(" · "), input.note].filter(Boolean).join("\n").trim();
  return insertAttivita({
    tenantId: candidatura.tenantId,
    candidaturaId: candidatura.id,
    tipo: "PROVA_PROGRAMMATA",
    occurredAt: input.scheduledAt,
    createdById,
    note,
    statoA: candidatura.stato,
  });
}

function encodeProvaProgrammataNote(input: {
  modalita?: string;
  intervistatoreLabel?: string;
  note: string;
}): string {
  const modalitaLabels: Record<string, string> = {
    PRESENZA: "In presenza",
    VIDEO: "Video",
    TELEFONO: "Telefono",
  };
  const meta: string[] = [];
  if (input.modalita) {
    meta.push(`Modalità: ${modalitaLabels[input.modalita] || input.modalita}`);
  }
  if (input.intervistatoreLabel) {
    meta.push(`Affiancatore: ${input.intervistatoreLabel}`);
  }
  return [meta.join(" · "), input.note].filter(Boolean).join("\n").trim();
}

export async function updateProvaProgrammata(
  tenantId: string,
  createdById: string,
  input: {
    id: string;
    candidaturaId: string;
    scheduledAt: Date;
    note: string;
    modalita?: string;
    intervistatoreLabel?: string;
  }
): Promise<RecruitingAttivitaRecord> {
  void createdById;
  const candidatura = await assertCandidaturaDelTenant(tenantId, input.candidaturaId);
  assertCandidaturaOperabile(candidatura.stato);
  if (candidatura.stato !== "PROVA" && candidatura.stato !== "COLLOQUIO") {
    throw new Error("La prova si modifica solo in fase Prova");
  }
  const list = await listAttivitaByCandidatura(candidatura.tenantId, candidatura.id);
  const current = list.find((a) => a.id === input.id && a.tipo === "PROVA_PROGRAMMATA");
  if (!current) throw new Error("Prova non trovata");
  const note = encodeProvaProgrammataNote({
    modalita: input.modalita,
    intervistatoreLabel: input.intervistatoreLabel,
    note: input.note,
  });
  if (!recruitingUsesSql()) {
    const result = await prisma.recruitingAttivita.updateMany({
      where: {
        id: input.id,
        tenantId: candidatura.tenantId,
        candidaturaId: candidatura.id,
        tipo: "PROVA_PROGRAMMATA",
      },
      data: { occurredAt: input.scheduledAt, note },
    });
    if (result.count !== 1) throw new Error("Prova non trovata");
    const row = await prisma.recruitingAttivita.findFirst({
      where: { id: input.id, tenantId: candidatura.tenantId },
      include: { createdBy: { select: { name: true, cognome: true } } },
    });
    if (!row) throw new Error("Prova non aggiornata");
    return toAttivitaRecord(row);
  }
  const pool = await recruitingPool();
  const upd = await pool
    .request()
    .input("id", sql.NVarChar(64), input.id)
    .input("tenantId", sql.NVarChar(64), candidatura.tenantId)
    .input("candidaturaId", sql.NVarChar(64), candidatura.id)
    .input("occurredAt", sql.DateTime2, input.scheduledAt)
    .input("note", sql.NVarChar(2000), note)
    .query(`
      UPDATE dbo.RecruitingAttivita
      SET OccurredAt = @occurredAt, Note = @note
      WHERE Id = @id AND TenantId = @tenantId AND CandidaturaId = @candidaturaId AND Tipo = N'PROVA_PROGRAMMATA'
    `);
  if (upd.rowsAffected[0] !== 1) throw new Error("Prova non trovata");
  const refreshed = await listAttivitaByCandidatura(candidatura.tenantId, candidatura.id);
  const updated = refreshed.find((a) => a.id === input.id);
  if (!updated) throw new Error("Prova non aggiornata");
  return updated;
}

export async function salvaEsitoProva(
  tenantId: string,
  createdById: string,
  input: {
    provaId: string;
    esito: string;
    parere: string;
    valutazioneStelle: number;
  }
): Promise<RecruitingAttivitaRecord> {
  let candidaturaId = "";
  let provaOccurredAt = new Date();

  if (!recruitingUsesSql()) {
    const prova = await prisma.recruitingAttivita.findFirst({
      where: {
        id: input.provaId,
        tenantId: tenantIdOrThrow(tenantId),
        tipo: "PROVA_PROGRAMMATA",
      },
    });
    if (!prova) throw new Error("Prova non trovata");
    candidaturaId = prova.candidaturaId;
    provaOccurredAt = prova.occurredAt;
  } else {
    const pool = await recruitingPool();
    const res = await pool
      .request()
      .input("id", sql.NVarChar(64), input.provaId)
      .input("tenantId", sql.NVarChar(64), tenantIdOrThrow(tenantId))
      .query(`
        SELECT CandidaturaId, OccurredAt
        FROM dbo.RecruitingAttivita
        WHERE Id = @id AND TenantId = @tenantId AND Tipo = N'PROVA_PROGRAMMATA'
      `);
    const row = res.recordset[0] as { CandidaturaId?: string; OccurredAt?: Date } | undefined;
    if (!row?.CandidaturaId) throw new Error("Prova non trovata");
    candidaturaId = String(row.CandidaturaId);
    provaOccurredAt = row.OccurredAt || new Date();
  }

  const candidatura = await assertCandidaturaDelTenant(tenantId, candidaturaId);
  assertCandidaturaOperabile(candidatura.stato);
  if (candidatura.stato !== "PROVA") {
    throw new Error("L’esito prova si registra in fase Prova");
  }

  const note = encodeProvaEsitoNote({
    valutazioneStelle: input.valutazioneStelle,
    parere: input.parere,
  });

  const attivita = await listAttivitaByCandidatura(candidatura.tenantId, candidatura.id);
  const existing = attivita.find(
    (a) => a.tipo === "PROVA_ESITO" && a.colloquioId === input.provaId
  );

  if (existing) {
    if (!recruitingUsesSql()) {
      await prisma.recruitingAttivita.updateMany({
        where: {
          id: existing.id,
          tenantId: candidatura.tenantId,
          candidaturaId: candidatura.id,
          tipo: "PROVA_ESITO",
        },
        data: { esito: input.esito, note },
      });
      const row = await prisma.recruitingAttivita.findFirst({
        where: { id: existing.id, tenantId: candidatura.tenantId },
        include: { createdBy: { select: { name: true, cognome: true } } },
      });
      if (!row) throw new Error("Esito prova non aggiornato");
      return toAttivitaRecord(row);
    }
    const pool = await recruitingPool();
    await pool
      .request()
      .input("id", sql.NVarChar(64), existing.id)
      .input("tenantId", sql.NVarChar(64), candidatura.tenantId)
      .input("candidaturaId", sql.NVarChar(64), candidatura.id)
      .input("esito", sql.NVarChar(30), input.esito)
      .input("note", sql.NVarChar(2000), note)
      .query(`
        UPDATE dbo.RecruitingAttivita
        SET Esito = @esito, Note = @note
        WHERE Id = @id AND TenantId = @tenantId AND CandidaturaId = @candidaturaId AND Tipo = N'PROVA_ESITO'
      `);
    const refreshed = await listAttivitaByCandidatura(candidatura.tenantId, candidatura.id);
    const updated = refreshed.find((a) => a.id === existing.id);
    if (!updated) throw new Error("Esito prova non aggiornato");
    return updated;
  }

  const occurredAt = new Date(
    Math.max(Date.now(), new Date(provaOccurredAt).getTime() + 1000)
  );
  return insertAttivita({
    tenantId: candidatura.tenantId,
    candidaturaId: candidatura.id,
    tipo: "PROVA_ESITO",
    occurredAt,
    createdById,
    note,
    esito: input.esito,
    statoA: "PROVA",
    colloquioId: input.provaId,
  });
}

export async function updateContattoAttivita(
  tenantId: string,
  createdById: string,
  input: {
    id: string;
    candidaturaId: string;
    canale: CanaleContatto;
    esito: EsitoContatto;
    occurredAt: Date;
    note: string;
  }
): Promise<RecruitingAttivitaRecord> {
  void createdById;
  const candidatura = await assertCandidaturaDelTenant(tenantId, input.candidaturaId);
  assertCandidaturaOperabile(candidatura.stato);
  if (
    candidatura.stato !== "RICEVUTA" &&
    candidatura.stato !== "IN_VALUTAZIONE" &&
    candidatura.stato !== "COLLOQUIO"
  ) {
    throw new Error("Il contatto si modifica solo in Candidatura o Colloquio");
  }
  const list = await listAttivitaByCandidatura(candidatura.tenantId, candidatura.id);
  const current = list.find((a) => a.id === input.id && a.tipo === "CONTATTO");
  if (!current) throw new Error("Contatto non trovato");
  if (!recruitingUsesSql()) {
    const result = await prisma.recruitingAttivita.updateMany({
      where: {
        id: input.id,
        tenantId: candidatura.tenantId,
        candidaturaId: candidatura.id,
        tipo: "CONTATTO",
      },
      data: {
        canale: input.canale,
        esito: input.esito,
        occurredAt: input.occurredAt,
        note: input.note,
      },
    });
    if (result.count !== 1) throw new Error("Contatto non trovato");
    const row = await prisma.recruitingAttivita.findFirst({
      where: { id: input.id, tenantId: candidatura.tenantId },
      include: { createdBy: { select: { name: true, cognome: true } } },
    });
    if (!row) throw new Error("Contatto non aggiornato");
    return toAttivitaRecord(row);
  }
  const pool = await recruitingPool();
  const upd = await pool
    .request()
    .input("id", sql.NVarChar(64), input.id)
    .input("tenantId", sql.NVarChar(64), candidatura.tenantId)
    .input("candidaturaId", sql.NVarChar(64), candidatura.id)
    .input("canale", sql.NVarChar(20), input.canale)
    .input("esito", sql.NVarChar(30), input.esito)
    .input("occurredAt", sql.DateTime2, input.occurredAt)
    .input("note", sql.NVarChar(2000), input.note)
    .query(`
      UPDATE dbo.RecruitingAttivita
      SET Canale = @canale, Esito = @esito, OccurredAt = @occurredAt, Note = @note
      WHERE Id = @id AND TenantId = @tenantId AND CandidaturaId = @candidaturaId AND Tipo = N'CONTATTO'
    `);
  if (upd.rowsAffected[0] !== 1) throw new Error("Contatto non trovato");
  const refreshed = await listAttivitaByCandidatura(candidatura.tenantId, candidatura.id);
  const updated = refreshed.find((a) => a.id === input.id);
  if (!updated) throw new Error("Contatto non aggiornato");
  return updated;
}
