export const CODICI_SCARICO = ["PTC", "PPC", "MOV", "LPP", "LPT"] as const;

export type CodiceScarico = (typeof CODICI_SCARICO)[number];

const STATO_SCARICO: Record<string, CodiceScarico> = {
  INCASSO: "PTC",
  PROMESSA: "PPC",
  INESIGIBILE: "MOV",
  PIANO: "LPP",
  RESA: "LPT",
};

export const CODICE_SCARICO_LABELS: Record<CodiceScarico, string> = {
  PTC: "Pagato / chiuso",
  PPC: "Promessa pagamento",
  MOV: "Inesigibile",
  LPP: "Piano di rientro",
  LPT: "Resa mandante",
};

export function codiceScaricoDaStato(stato: string): CodiceScarico | null {
  return STATO_SCARICO[stato] ?? null;
}

export function codiceScaricoPratica(stato: string, codiceScarico?: string | null) {
  if (codiceScarico && CODICI_SCARICO.includes(codiceScarico as CodiceScarico)) {
    return codiceScarico as CodiceScarico;
  }
  return STATO_SCARICO[stato] ?? null;
}

export function praticaAffidato(capitale: number, interessi: number, spese: number) {
  return (capitale || 0) + (interessi || 0) + (spese || 0);
}

export function pctSuAffidato(importo: number, affidato: number) {
  if (!affidato) return 0;
  return (importo / affidato) * 100;
}

export function pctPezzi(count: number, totale: number) {
  if (!totale) return 0;
  return (count / totale) * 100;
}

export function fmtPct(value: number) {
  return value.toLocaleString("it-IT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
