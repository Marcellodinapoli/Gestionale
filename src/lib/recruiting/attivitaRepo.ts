import "server-only";
import { prisma } from "@/lib/prisma";
import { getCandidatura } from "@/lib/recruiting/candidatureRepo";
import { getOffertaLavoro } from "@/lib/recruiting/offerteRepo";
import {
  assertCandidaturaOperabile,
  type RecruitingCandidaturaRecord,
} from "@/lib/recruiting/candidature";
import {
  toAttivitaRecord,
  type CanaleContatto,
  type EsitoContatto,
  type RecruitingAttivitaRecord,
  type TipoAttivita,
} from "@/lib/recruiting/attivita";

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
  const rows = await prisma.recruitingAttivita.findMany({
    where: { tenantId: candidatura.tenantId, candidaturaId: candidatura.id },
    include: { createdBy: { select: { name: true, cognome: true } } },
    orderBy: { occurredAt: "asc" },
  });
  return rows.map(toAttivitaRecord);
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
  return insertAttivita({
    tenantId: candidatura.tenantId,
    candidaturaId: candidatura.id,
    tipo: "CONTATTO",
    occurredAt: input.occurredAt,
    createdById,
    note: input.note,
    esito: input.esito,
    canale: input.canale,
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
  });
}
