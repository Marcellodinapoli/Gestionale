export const PORTAFOGLIO_TIPI = ["UTP", "NPL", "MISTO"] as const;
export type PortafoglioTipo = (typeof PORTAFOGLIO_TIPI)[number];

export const PORTAFOGLIO_STATI = [
  "IN_VALUTAZIONE",
  "NON_ACQUISITO",
  "COMPRATO",
  "IN_GESTIONE",
  "CHIUSO",
] as const;
export type PortafoglioStato = (typeof PORTAFOGLIO_STATI)[number];

export const PORTAFOGLIO_TIPO_LABELS: Record<PortafoglioTipo, string> = {
  UTP: "UTP",
  NPL: "NPL",
  MISTO: "Misto",
};

export const PORTAFOGLIO_STATO_LABELS: Record<PortafoglioStato, string> = {
  IN_VALUTAZIONE: "In valutazione",
  NON_ACQUISITO: "Non acquisito",
  COMPRATO: "Comprato",
  IN_GESTIONE: "In gestione",
  CHIUSO: "Chiuso",
};

export type PortafoglioRecord = {
  id: string;
  tenantId: string;
  nome: string;
  codice: string | null;
  venditore: string | null;
  servicer: string | null;
  tipo: PortafoglioTipo;
  stato: PortafoglioStato;
  dataCutoff: Date | null;
  dataAcquisto: Date | null;
  nominaleDichiarato: number;
  prezzoOfferto: number | null;
  prezzoPagato: number | null;
  speseAcquisto: number;
  recuperoAtteso: number | null;
  note: string | null;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type PortafoglioWriteInput = {
  nome: string;
  codice?: string | null;
  venditore?: string | null;
  servicer?: string | null;
  tipo: PortafoglioTipo;
  stato: PortafoglioStato;
  dataCutoff?: Date | null;
  dataAcquisto?: Date | null;
  nominaleDichiarato?: number;
  prezzoOfferto?: number | null;
  prezzoPagato?: number | null;
  speseAcquisto?: number;
  recuperoAtteso?: number | null;
  note?: string | null;
};

export type PortafoglioListRow = PortafoglioRecord & {
  nPratiche: number;
  residuo: number;
  incassato: number;
};

export type PortafoglioKpi = {
  nPratiche: number;
  residuo: number;
  incassato: number;
  nominalePratiche: number;
  perStato: Array<{ stato: string; count: number }>;
};

export type PortafoglioPraticaRow = {
  id: string;
  numero: string;
  stato: string;
  residuo: number;
  totIncassato: number;
  debitore: string;
};

export type ImportBatchOption = {
  id: string;
  lotto: string;
  perimetro: string;
  nPratiche: number;
  createdAt: Date;
};

export function isPortafoglioTipo(v: string): v is PortafoglioTipo {
  return (PORTAFOGLIO_TIPI as readonly string[]).includes(v);
}

export function isPortafoglioStato(v: string): v is PortafoglioStato {
  return (PORTAFOGLIO_STATI as readonly string[]).includes(v);
}
