export const NOTA_BOZZA_EVENT = "gestionale:nota-bozza";

export type NotaBozzaDetail = {
  testo: string;
};

export function apriNotaBozza(testo: string) {
  if (typeof window === "undefined" || !testo.trim()) return;
  window.dispatchEvent(
    new CustomEvent<NotaBozzaDetail>(NOTA_BOZZA_EVENT, { detail: { testo } })
  );
}
