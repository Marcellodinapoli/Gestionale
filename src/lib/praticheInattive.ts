import type { Prisma } from "@prisma/client";

export const STATI_PRATICA_CHIUSA = ["INCASSO", "RESA", "INESIGIBILE"] as const;

export type NonToccateDa = 7 | 15;

export function sogliaGiorniFa(giorni: number) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - giorni);
  return d;
}

export function parseNonToccateDa(raw?: string | null): NonToccateDa | undefined {
  if (raw === "7" || raw === "15") return Number(raw) as NonToccateDa;
  return undefined;
}

/** Pratiche aperte senza aggiornamenti da almeno N giorni (ultimo tocco = updatedAt). */
export function praticheNonToccateWhere(giorni: NonToccateDa): Prisma.PraticaWhereInput {
  return {
    updatedAt: { lt: sogliaGiorniFa(giorni) },
    stato: { notIn: [...STATI_PRATICA_CHIUSA] },
  };
}

export function etichettaNonToccateDa(giorni: NonToccateDa) {
  return `Non toccate da ${giorni}+ gg`;
}
