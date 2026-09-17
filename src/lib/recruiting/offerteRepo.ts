import "server-only";
import { prisma } from "@/lib/prisma";
import {
  assertTransizioneOfferta,
  toOffertaLavoroRecord,
  type OffertaLavoroRecord,
  type OffertaLavoroWriteInput,
} from "@/lib/recruiting/offerte";

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

/** Elenco offerte del tenant (isolamento obbligatorio). */
export async function listOfferteLavoro(tenantId: string): Promise<OffertaLavoroRecord[]> {
  const tid = tenantIdOrThrow(tenantId);
  const rows = await prisma.offertaLavoro.findMany({
    where: { tenantId: tid },
    orderBy: { updatedAt: "desc" },
  });
  return rows.map(toOffertaLavoroRecord);
}

export async function getOffertaLavoro(
  tenantId: string,
  id: string
): Promise<OffertaLavoroRecord | null> {
  const tid = tenantIdOrThrow(tenantId);
  const oid = String(id || "").trim();
  if (!oid) return null;
  const row = await prisma.offertaLavoro.findFirst({
    where: { id: oid, tenantId: tid },
  });
  return row ? toOffertaLavoroRecord(row) : null;
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

export async function updateOffertaLavoro(
  tenantId: string,
  id: string,
  input: OffertaLavoroWriteInput
): Promise<OffertaLavoroRecord> {
  const tid = tenantIdOrThrow(tenantId);
  const oid = offertaIdOrThrow(id);
  const current = await getOffertaLavoro(tid, oid);
  if (!current) throw new Error("Offerta non trovata");
  const nextStato = input.stato || current.stato;
  assertTransizioneOfferta(current.stato, nextStato);
  const result = await prisma.offertaLavoro.updateMany({
    where: { id: oid, tenantId: tid, stato: { not: "CHIUSA" } },
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
  const updated = await getOffertaLavoro(tid, oid);
  if (!updated) throw new Error("Offerta non trovata");
  return updated;
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
  const result = await prisma.offertaLavoro.updateMany({
    where: { id: oid, tenantId: tid, stato: { not: "CHIUSA" } },
    data: { stato: "CHIUSA" },
  });
  if (result.count !== 1) throw new Error("Offerta non trovata");
  const updated = await getOffertaLavoro(tid, oid);
  if (!updated) throw new Error("Offerta non trovata");
  return updated;
}
