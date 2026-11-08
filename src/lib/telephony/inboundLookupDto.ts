export type InboundCallPraticaMatch = {
  praticaId: string;
  numero: string;
  debitore: string;
  mandanteCodice: string;
  mandanteRagioneSociale: string;
  inLavorazione: boolean;
  statoLabel: string;
  praticaChiusa: boolean;
  /** Debito residuo (campo pratica.residuo). */
  residuo: number;
  /** Netto da pagare (come in scheda: nettoDaPagare − pagato, o residuo − pagato). */
  nettoDaPagare: number;
  /** Se false, non mostrare link scheda; usare `faseDescrizione`. */
  schedaApribile: boolean;
  /** Presente se `schedaApribile` è false (scaduta, legale, ecc.). */
  faseDescrizione?: string;
};

export type InboundCallLookupResponse = {
  numero: string;
  /** Eco del DID passato dall’integrazione (se presente). */
  numeroChiamato?: string;
  matches: InboundCallPraticaMatch[];
};
