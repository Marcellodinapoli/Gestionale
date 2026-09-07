/**
 * Catalogo workflow del verticale RECUPERO_CREDITI.
 * Solo organizzazione: valori identici a quelli storici in permissions/scarico.
 */

export const STATO_LABELS: Record<string, string> = {
  NUOVA: "Nuova",
  AFFIDATA: "In lavorazione",
  IN_LAVORAZIONE: "In lavorazione",
  SCADUTA: "Scaduta",
  // Legacy / chiusure reali (non in tendina filtro)
  PROMESSA: "In lavorazione",
  PIANO: "In lavorazione",
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

/** Mapping stato chiusura ↔ codice scarico (recupero crediti).
 * PTC / PPC / LPP sono solo codice scarico: non cambiano il ciclo di vita
 * (resta IN_LAVORAZIONE fino a scadenza; INCASSO solo con residuo azzerato da incasso).
 * MOV / LPT chiudono ancora la pratica (inesigibile / resa).
 */
export const STATO_SCARICO: Record<string, CodiceScarico> = {
  INESIGIBILE: "MOV",
  RESA: "LPT",
};
