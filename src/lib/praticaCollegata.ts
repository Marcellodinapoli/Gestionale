import { statoOperativoPratica } from "@/lib/statoOperativoPratica";

export const STATI_PRATICA_CHIUSA = new Set(["INCASSO", "INESIGIBILE", "RESA"]);

export type FiltroCollegata = "aperta" | "chiusa";

export type PraticaFiltroCollegataInput = {
  stato: string;
  assegnatarioId?: string | null;
  scadenza?: Date | string | null;
  codiceScaricoBk?: string | null;
  /** Codice mandante (per split F9/F10). */
  mandante?: string | null;
  mandanteId?: string | null;
};

export type MandanteRef = {
  mandante?: string | null;
  mandanteId?: string | null;
};

export function isPraticaChiusa(stato: string) {
  return STATI_PRATICA_CHIUSA.has(stato);
}

/**
 * F9: Nuove / In lavorazione (non scadute, non chiuse).
 * Usare con filtro stessa mandante a parte.
 */
export function isPraticaF9Aperta(input: PraticaFiltroCollegataInput) {
  const op = statoOperativoPratica(input);
  return op === "NUOVA" || op === "IN_LAVORAZIONE";
}

function stessoMandante(a: MandanteRef, b: MandanteRef) {
  if (a.mandanteId && b.mandanteId) return a.mandanteId === b.mandanteId;
  if (a.mandante && b.mandante) return a.mandante === b.mandante;
  return false;
}

/**
 * F9: stessa mandante + Nuova/In lavorazione (non perimetro).
 */
export function isPraticaF9Collegata(
  p: PraticaFiltroCollegataInput,
  corrente: MandanteRef
) {
  return stessoMandante(p, corrente) && isPraticaF9Aperta(p);
}

/**
 * F10: tutte le altre collegate (altre mandanti, scadute, chiuse, …).
 */
export function isPraticaF10Collegata(
  p: PraticaFiltroCollegataInput,
  corrente: MandanteRef
) {
  return !isPraticaF9Collegata(p, corrente);
}

export function praticaMatchFiltro(
  input: PraticaFiltroCollegataInput | string,
  filtro: FiltroCollegata,
  /** Mandante della pratica da cui si apre F9/F10 (obbligatorio per lo split corretto). */
  corrente?: MandanteRef
) {
  const p: PraticaFiltroCollegataInput =
    typeof input === "string" ? { stato: input } : input;
  if (corrente) {
    return filtro === "chiusa"
      ? isPraticaF10Collegata(p, corrente)
      : isPraticaF9Collegata(p, corrente);
  }
  // Fallback senza contesto mandante (liste già ristrette a stessa mandante).
  if (filtro === "chiusa") return !isPraticaF9Aperta(p);
  return isPraticaF9Aperta(p);
}

export function parseFiltroCollegata(
  value?: string | null
): FiltroCollegata | undefined {
  if (value === "aperta" || value === "chiusa") return value;
  return undefined;
}

export function buildPraticaCollegataHref(
  id: string,
  filtro: FiltroCollegata,
  opts?: { elenco?: boolean; da?: string }
) {
  const qs = new URLSearchParams({ collegata: filtro });
  if (opts?.elenco) qs.set("elenco", "1");
  if (opts?.da) qs.set("da", opts.da);
  return `/pratiche/${id}?${qs.toString()}`;
}

export function buildPraticaCollegataElencoHref(
  id: string,
  filtro: FiltroCollegata,
  da?: string
) {
  return buildPraticaCollegataHref(id, filtro, { elenco: true, da: da ?? id });
}

/** Chiude il pannello elenco ma resta nel filtro collegate (paginazione 1/N, F3, frecce). */
export function buildPraticaCollegataChiudiElencoHref(
  id: string,
  filtro: FiltroCollegata,
  da?: string
) {
  return buildPraticaCollegataHref(id, filtro, { da });
}

export function parsePraticaOrigine(value?: string | null) {
  return value?.trim() || undefined;
}

export function etichettaFiltroCollegata(filtro: FiltroCollegata) {
  return filtro === "chiusa"
    ? "Altre collegate (mandanti / scadute / chiuse)"
    : "In lavorazione e nuove (stessa mandante)";
}
