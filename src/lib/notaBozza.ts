export const NOTA_BOZZA_EVENT = "gestionale:nota-bozza";
/** Apre il modal F5 (nota / esito) senza bozza precompilata. */
export const APRI_NOTA_F5_EVENT = "gestionale:apri-nota-f5";

export type NotaBozzaDetail = {
  testo: string;
};

export function apriNotaBozza(testo: string) {
  if (typeof window === "undefined" || !testo.trim()) return;
  window.dispatchEvent(
    new CustomEvent<NotaBozzaDetail>(NOTA_BOZZA_EVENT, { detail: { testo } })
  );
}

/** Apre F5 · Nota registro / esito (stesso effetto del tasto F5). */
export function apriNotaF5() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(APRI_NOTA_F5_EVENT));
}
