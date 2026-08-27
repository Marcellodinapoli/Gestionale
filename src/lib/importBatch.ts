export type ImportBatchListItem = {
  id: string;
  mandanteId: string;
  mandanteCodice: string;
  perimetro: string;
  lotto: string;
  affidoIl: string;
  scadenzaMandato: string | null;
  fileName: string | null;
  nPratiche: number;
  createdAt: string;
  createdByName: string | null;
  hasMovimenti: boolean;
  hasNote: boolean;
  hasCambioCodice: boolean;
};

export function importBatchBloccato(item: {
  hasMovimenti: boolean;
  hasNote: boolean;
  hasCambioCodice: boolean;
}) {
  return item.hasMovimenti || item.hasNote || item.hasCambioCodice;
}

export function praticaHaNote(note: string | null | undefined) {
  return Boolean(note && String(note).trim());
}

export function praticaHaCambioCodice(codiceScarico: string | null | undefined) {
  return Boolean(codiceScarico && String(codiceScarico).trim());
}
