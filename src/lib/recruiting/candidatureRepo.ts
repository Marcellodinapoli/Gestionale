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

async function assertOffertaDelTenant(tenantId: string, offertaId: string) {
  const offerta = await getOffertaLavoro(tenantId, offertaId);
  if (!offerta) throw new Error("Offerta non trovata");
  return offerta;
}

export async function countCandidatureByOfferta(
  tenantId: string
): Promise<Record<string, number>> {
  const tid = tenantIdOrThrow(tenantId);
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

export async function listCandidatureRecenti(
  tenantId: string,
  limit = 50
): Promise<Array<RecruitingCandidaturaRecord & { offertaTitolo: string }>> {
  const tid = tenantIdOrThrow(tenantId);
  const take = Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 100) : 50;
  const rows = await prisma.recruitingCandidatura.findMany({
    where: { tenantId: tid },
    orderBy: { receivedAt: "desc" },
    take,
    include: { offerta: { select: { titolo: true } } },
  });
  return rows.map((row) => ({
    ...toCandidaturaRecord(row),
    offertaTitolo: row.offerta?.titolo || "",
  }));
}

export async function listCandidatureByOfferta(
  tenantId: string,
  offertaId: string
): Promise<RecruitingCandidaturaRecord[]> {
  const tid = tenantIdOrThrow(tenantId);
  const oid = idOrThrow(offertaId, "Offerta");
  await assertOffertaDelTenant(tid, oid);
  const rows = await prisma.recruitingCandidatura.findMany({
    where: { tenantId: tid, offertaId: oid },
    orderBy: { receivedAt: "desc" },
  });
  return rows.map(toCandidaturaRecord);
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
  const row = await prisma.recruitingCandidatura.findFirst({
    where: oid
      ? { id: cid, tenantId: tid, offertaId: oid }
      : { id: cid, tenantId: tid },
  });
  return row ? toCandidaturaRecord(row) : null;
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
  const row = await prisma.$transaction(async (tx) => {
    const created = await tx.recruitingCandidatura.create({
      data: {
        tenantId: tid,
        offertaId: input.offertaId,
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
  const updated = await getCandidatura(tid, cid);
  if (!updated) throw new Error("Candidatura non trovata");
  return updated;
}
