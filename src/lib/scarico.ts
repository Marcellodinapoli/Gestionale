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

const STATI_CHIUSURA = new Set(["INCASSO", "INESIGIBILE", "RESA"]);

/**
 * Solo MOV/LPT (codice scarico **back office**) chiudono la pratica.
 * Il codice operatore non aggiorna più Sit. affido.
 */
export function statoChiusuraDaCodiceScarico(codice: string): string | null {
  const stato = statoDaCodiceScarico(codice);
  return stato && STATI_CHIUSURA.has(stato) ? stato : null;
}

/**
 * Sit. affido da codice bk off: MOV/LPT → chiusura; assente o altro → riapre.
 * INCASSO resta gestito a parte (residuo azzerato).
 */
export function statoDaCodiceScaricoBk(
  codiceBk: string | null | undefined,
  opts?: { assegnatarioId?: string | null; statoCorrente?: string | null }
): string {
  const key = (codiceBk || "").trim().toUpperCase();
  const chiusura = key ? statoChiusuraDaCodiceScarico(key) : null;
  if (chiusura) return chiusura;
  if (opts?.statoCorrente === "INCASSO") return "INCASSO";
  if (opts?.assegnatarioId) return "IN_LAVORAZIONE";
  return "NUOVA";
}

/** Dopo un codice non di chiusura: passa a IN_LAVORAZIONE (anche se era RESA/INESIGIBILE). */
export function statoOperativoDopoScaricoAperto(statoCorrente: string): string {
  if (statoCorrente === "INCASSO") return "INCASSO";
  return "IN_LAVORAZIONE";
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
  const raw = (codiceScarico || "").trim().toUpperCase();
  if (raw) {
    if (CODICI_SCARICO.includes(raw as CodiceScarico)) {
      return raw as CodiceScarico;
    }
    // Codici custom di perimetro (es. LPI, DRI): mantieni il valore salvato.
    return raw;
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
