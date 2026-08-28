import { importoIt } from "@/lib/domainFormat";

/** Tipi/helper statistiche — senza Prisma/Firebase (safe per Client Components). */

export type StatisticheFiltri = {
  affidoDa?: Date;
  affidoA?: Date;
  mandanteId?: string;
  /** Uno o più perimetri (numeroMandante). */
  lotti?: string[];
};

export type ScaricoColonna = {
  codice: string;
  /** Incassato totale sulle pratiche con questo codice. */
  importo: number;
  /** % pratiche incassate codice / Nr Prt operatore. */
  pctPz: number;
  /** Pratiche incassate con questo codice (colonna Pz). */
  nr: number;
};

export type StatisticheRiga = {
  esa: string;
  mandato: string;
  /** Acronimo interno del perimetro. */
  perimetro: string;
  /** Lotto (numeroMandante / import). */
  lotto: string;
  nrPrt: number;
  affidato: number;
  incassato: number;
  nrPzInc: number;
  pctPzIncAffidato: number;
  pctPzIncPezzi: number;
  /** Pratiche con almeno un incasso. */
  movimentate: number;
  scarichi: ScaricoColonna[];
  isTotale?: boolean;
};

export type StatisticheSezione = {
  perimetro: string;
  /** Codici scarico del perimetro (ordine colonne). */
  codiciScarico: string[];
  righe: StatisticheRiga[];
  subtotale: StatisticheRiga;
};

export function fmtImportoTabella(value: number) {
  return importoIt(value);
}

/** Colonne fisse prima del blocco codici scarico (inclusa Movimentate). */
export function colonneFisseStatistiche() {
  return 8;
}

export function colonneCodiciScarico(codiciScarico: string[]) {
  return codiciScarico.length * 3;
}

export function colspanTabellaStatistiche(codiciScarico: string[]) {
  return colonneFisseStatistiche() + colonneCodiciScarico(codiciScarico);
}

export type LottoPerimetroFiltro = {
  /** Lotto / numeroMandante (valore filtro). */
  value: string;
  /** Acronimo interno perimetro. */
  label: string;
  /** Tooltip opzionale (es. lotto mandante). */
  title?: string;
};
