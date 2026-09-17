import "server-only";
import { prisma } from "@/lib/prisma";
import {
  assertCandidaturaOperabile,
} from "@/lib/recruiting/candidature";
import {
  assertCanCreateColloquio,
  assertTransizioneColloquio,
  toColloquioRecord,
  type EsitoColloquio,
  type ModalitaColloquio,
  type RecruitingColloquioRecord,
} from "@/lib/recruiting/colloqui";
import { assertCandidaturaDelTenant } from "@/lib/recruiting/attivitaRepo";

function tenantIdOrThrow(tenantId: string) {
  const id = String(tenantId || "").trim();
  if (!id) throw new Error("Tenant mancante");
  return id;
}

async function assertIntervistatoreDelTenant(tenantId: string, userId: string) {
  const uid = String(userId || "").trim();
  if (!uid) return;
  const user = await prisma.user.findFirst({
    where: { id: uid, tenantId },
    select: { id: true },
  });
  if (!user) throw new Error("Intervistatore non valido");
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
  const row = await prisma.recruitingColloquio.findFirst({
    where: oid
      ? { id: cid, tenantId: tid, candidaturaId: oid }
      : { id: cid, tenantId: tid },
    include: { intervistatore: { select: { name: true, cognome: true } } },
  });
  return row ? toColloquioRecord(row) : null;
}

export async function listColloquiByCandidatura(
  tenantId: string,
  candidaturaId: string
): Promise<RecruitingColloquioRecord[]> {
  const candidatura = await assertCandidaturaDelTenant(tenantId, candidaturaId);
  const rows = await prisma.recruitingColloquio.findMany({
    where: { tenantId: candidatura.tenantId, candidaturaId: candidatura.id },
    include: { intervistatore: { select: { name: true, cognome: true } } },
    orderBy: { round: "asc" },
  });
  return rows.map(toColloquioRecord);
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

export async function listUtentiTenantRecruiting(
  tenantId: string
): Promise<Array<{ id: string; name: string }>> {
  const tid = tenantIdOrThrow(tenantId);
  const rows = await prisma.user.findMany({
    where: { tenantId: tid, active: true },
    select: { id: true, name: true, cognome: true },
    orderBy: { name: "asc" },
  });
  return rows.map((u) => ({
    id: u.id,
    name: [u.name, u.cognome].filter(Boolean).join(" ").trim() || u.name,
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

async function transizioneColloquio(input: {
  tenantId: string;
  createdById: string;
  id: string;
  to: "SVOLTO" | "ESITATO" | "ANNULLATO";
  noteSvolgimento?: string;
  esito?: EsitoColloquio;
  valutazione?: string;
}): Promise<RecruitingColloquioRecord> {
  const current = await getColloquioDelTenant(input.tenantId, input.id);
  if (!current) throw new Error("Colloquio non trovato");
  const candidatura = await assertCandidaturaDelTenant(input.tenantId, current.candidaturaId);
  if (current.tenantId !== candidatura.tenantId) throw new Error("Colloquio non trovato");
  assertCandidaturaOperabile(candidatura.stato);
  assertTransizioneColloquio(current.stato, input.to);

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
      },
    });
    if (result.count !== 1) throw new Error("Colloquio non trovato");
    const tipo =
      input.to === "SVOLTO"
        ? "COLLOQUIO_SVOLTO"
        : input.to === "ESITATO"
          ? "COLLOQUIO_ESITO"
          : "COLLOQUIO_ANNULLATO";
    await tx.recruitingAttivita.create({
      data: {
        tenantId: candidatura.tenantId,
        candidaturaId: candidatura.id,
        tipo,
        occurredAt: new Date(),
        note:
          input.to === "SVOLTO"
            ? input.noteSvolgimento || ""
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

export async function svolgiColloquio(
  tenantId: string,
  createdById: string,
  input: { id: string; noteSvolgimento: string }
): Promise<RecruitingColloquioRecord> {
  return transizioneColloquio({
    tenantId,
    createdById,
    id: input.id,
    to: "SVOLTO",
    noteSvolgimento: input.noteSvolgimento,
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
