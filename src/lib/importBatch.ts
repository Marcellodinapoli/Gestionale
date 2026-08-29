export type ImportBatchBlocchi = {
  note: number;
  codice: number;
  incassi: number;
};

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
  blocchi: ImportBatchBlocchi;
};

export function importBatchBloccato(item: {
  hasMovimenti: boolean;
  hasNote: boolean;
  hasCambioCodice: boolean;
}) {
  return item.hasMovimenti || item.hasNote || item.hasCambioCodice;
}

export function motivoBloccoImportBatch(blocchi: ImportBatchBlocchi): string | null {
  const parti: string[] = [];
  if (blocchi.note > 0) {
    parti.push(`${blocchi.note} pratiche con note`);
  }
  if (blocchi.codice > 0) {
    parti.push(`${blocchi.codice} pratiche con cambio codice`);
  }
  if (blocchi.incassi > 0) {
    parti.push(`${blocchi.incassi} movimenti (incassi)`);
  }
  if (!parti.length) return null;
  return `Non eliminabile: ${parti.join(", ")}`;
}

export function praticaHaNote(note: string | null | undefined) {
  return Boolean(note && String(note).trim());
}

/** Cambio codice operatore: richiede data impostazione, non solo presenza codice. */
export function praticaHaCambioCodice(
  codiceScaricoAt: Date | string | null | undefined
) {
  return codiceScaricoAt != null && String(codiceScaricoAt).trim() !== "";
}
