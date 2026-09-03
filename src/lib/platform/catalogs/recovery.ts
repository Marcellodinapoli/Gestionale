/**
 * Catalogo workflow del verticale RECUPERO_CREDITI.
 * Solo organizzazione: valori identici a quelli storici in permissions/scarico.
 */

export const STATO_LABELS: Record<string, string> = {
  NUOVA: "Nuova",
  AFFIDATA: "Affidata",
  IN_LAVORAZIONE: "In lavorazione",
  PROMESSA: "Promessa",
  PIANO: "Piano di rientro",
  INCASSO: "Incassata",
  INESIGIBILE: "Inesigibile",
  RESA: "Resa mandante",
};

export const CODICI_SCARICO = ["PTC", "PPC", "MOV", "LPP", "LPT"] as const;

export type CodiceScarico = (typeof CODICI_SCARICO)[number];

export const CODICI_SCARICO_DETTAGLIO_PAGAMENTO = ["LPI", "LPP", "LPT"] as const;

export const CODICE_SCARICO_LABELS: Record<CodiceScarico, string> = {
  PTC: "Pagato / chiuso",
  PPC: "Promessa pagamento",
  MOV: "Inesigibile",
  LPP: "Piano di rientro",
  LPT: "Resa mandante",
};

/** Mapping stato pratica ↔ codice scarico (recupero crediti). */
export const STATO_SCARICO: Record<string, CodiceScarico> = {
  INCASSO: "PTC",
  PROMESSA: "PPC",
  INESIGIBILE: "MOV",
  PIANO: "LPP",
  RESA: "LPT",
};
