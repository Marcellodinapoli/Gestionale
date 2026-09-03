import {
  CODICE_SCARICO_LABELS,
  CODICI_SCARICO,
  CODICI_SCARICO_DETTAGLIO_PAGAMENTO,
  STATO_SCARICO,
  type CodiceScarico,
} from "@/lib/platform/catalogs/recovery";

export {
  CODICE_SCARICO_LABELS,
  CODICI_SCARICO,
  CODICI_SCARICO_DETTAGLIO_PAGAMENTO,
  type CodiceScarico,
};

/** Codici promessa con data, importo e modalità di pagamento (solo LPI/LPP/LPT). */
export function isCodiceScaricoConDettagliPagamento(codice: string): boolean {
  const key = codice.trim().toUpperCase();
  if (!key) return false;
  return (CODICI_SCARICO_DETTAGLIO_PAGAMENTO as readonly string[]).includes(key);
}

export function codiceScaricoDaStato(stato: string): CodiceScarico | null {
  return STATO_SCARICO[stato] ?? null;
}

/** Stato pratica tipicamente associato a un codice scarico. */
export function statoDaCodiceScarico(codice: string): string | null {
  const entry = Object.entries(STATO_SCARICO).find(([, c]) => c === codice);
  return entry?.[0] ?? null;
}

export function isCodiceScarico(value?: string | null): value is CodiceScarico {
  return Boolean(value && CODICI_SCARICO.includes(value as CodiceScarico));
}

/** Filtro piano lavorazione: pratiche senza codice scarico (colonna «Senza»). */
export const CODICE_SCARICO_NULLI = "ND" as const;

export type CodiceScaricoVoce = CodiceScarico | typeof CODICE_SCARICO_NULLI | "";

export function isCodiceScaricoNulli(
  value?: string | null
): value is typeof CODICE_SCARICO_NULLI {
  return value === CODICE_SCARICO_NULLI;
}

export function parseCodiceScaricoVoce(cod: string): CodiceScaricoVoce {
  if (isCodiceScarico(cod)) return cod;
  if (isCodiceScaricoNulli(cod)) return CODICE_SCARICO_NULLI;
  return "";
}

/** Descrizione predefinita riga lavorazione per codice scarico (es. Nulli → Pratiche nuove). */
export function descrizioneDaCodiceScaricoVoce(codice: CodiceScaricoVoce): string {
  if (codice === CODICE_SCARICO_NULLI) return "Pratiche nuove";
  return "";
}

/** Where Prisma: campo codiceScarico assente o non valido (stato IN_LAVORAZIONE non mappa codici). */
export function whereSenzaCodiceScaricoPratica() {
  return {
    OR: [
      { codiceScarico: null },
      { codiceScarico: { notIn: [...CODICI_SCARICO] } },
    ],
  };
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
