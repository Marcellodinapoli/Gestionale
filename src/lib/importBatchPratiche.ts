import type { Prisma } from "@prisma/client";
import { giornoAffidoRange } from "@/lib/importContesto";
import type { ExistingPraticaImport } from "@/lib/importCsvPratiche";

export type ImportBatchScope = {
  mandanteId: string;
  lotto: string;
  affidoIl: Date | string;
};

export function affidoIlAsDate(affidoIl: Date | string): Date {
  return affidoIl instanceof Date ? affidoIl : new Date(String(affidoIl));
}

/** Pratiche appartenenti al lotto import (mandante + numero mandante + giorno affido). */
export function importBatchPraticheWhere(
  tenantId: string,
  batch: ImportBatchScope
): Prisma.PraticaWhereInput {
  const { start, end } = giornoAffidoRange(affidoIlAsDate(batch.affidoIl));
  return {
    tenantId,
    mandanteId: batch.mandanteId,
    numeroMandante: batch.lotto,
    dataAffido: { gte: start, lte: end },
  };
}

export const importBatchPraticaSelectForIndex = {
  id: true,
  debitoreId: true,
  contratto: true,
  commessa: true,
  stato: true,
  codiceScarico: true,
  note: true,
  debitore: { select: { codiceFiscale: true } },
} as const;

export function toExistingPraticaImport(
  p: Prisma.PraticaGetPayload<{ select: typeof importBatchPraticaSelectForIndex }>
): ExistingPraticaImport {
  return {
    id: p.id,
    debitoreId: p.debitoreId,
    contratto: p.contratto,
    commessa: p.commessa,
    stato: p.stato,
    codiceScarico: p.codiceScarico,
    note: p.note,
    debitore: { codiceFiscale: p.debitore.codiceFiscale },
  };
}
