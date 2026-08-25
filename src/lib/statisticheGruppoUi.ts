import { importoIt } from "@/lib/domainFormat";
import type { CodiceScarico } from "@/lib/scarico";

/** Tipi/helper statistiche — senza Prisma/Firebase (safe per Client Components). */

export type StatisticheFiltri = {
  affidoDa?: Date;
  affidoA?: Date;
  mandanteId?: string;
  /** Uno o più perimetri (numeroMandante). */
  lotti?: string[];
};

export type ScaricoColonna = {
  codice: CodiceScarico | "N/D";
  importo: number;
  nr: number;
  pctAffidato: number;
  pctPezzi: number;
};

export type StatisticheRiga = {
  esa: string;
  mandato: string;
  lottoCg: string;
  nrPrt: number;
  affidato: number;
  incassato: number;
  nrPzInc: number;
  pctPzIncAffidato: number;
  pctPzIncPezzi: number;
  scarichi: ScaricoColonna[];
  isTotale?: boolean;
};

export type StatisticheSezione = {
  perimetro: string;
  righe: StatisticheRiga[];
  subtotale: StatisticheRiga;
};

export function fmtImportoTabella(value: number) {
  return importoIt(value);
}
