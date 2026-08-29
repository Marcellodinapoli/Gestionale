export const STATI_PRATICA_CHIUSA = new Set(["INCASSO", "INESIGIBILE", "RESA"]);

export type FiltroCollegata = "aperta" | "chiusa";

export function isPraticaChiusa(stato: string) {
  return STATI_PRATICA_CHIUSA.has(stato);
}

export function praticaMatchFiltro(stato: string, filtro: FiltroCollegata) {
  const chiusa = isPraticaChiusa(stato);
  return filtro === "chiusa" ? chiusa : !chiusa;
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
  return filtro === "chiusa" ? "Collegate generiche" : "In lavorazione";
}
