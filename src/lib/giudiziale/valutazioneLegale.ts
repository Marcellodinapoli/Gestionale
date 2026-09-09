/** Costanti — Valutazione legale (fase giudiziale). */

export const TRISTATO_TITOLO = [
  { value: "SI", label: "Sì" },
  { value: "NO", label: "No" },
  { value: "DA_VERIFICARE", label: "Da verificare" },
] as const;

export type TriStatoTitolo = (typeof TRISTATO_TITOLO)[number]["value"];

export const TIPI_AZIONE_IPOTIZZATA = [
  { value: "DECRETO_INGIUNTIVO", label: "Decreto ingiuntivo" },
  { value: "CAUSA_ORDINARIA", label: "Causa ordinaria" },
  { value: "ALTRA_PROCEDURA", label: "Altra procedura" },
] as const;

export type TipoAzioneIpotizzata = (typeof TIPI_AZIONE_IPOTIZZATA)[number]["value"];

export const PARERI_VALUTAZIONE = [
  { value: "PROCEDERE", label: "Procedere" },
  { value: "PROCEDERE_CON_RISERVA", label: "Procedere con riserva" },
  { value: "NON_PROCEDERE", label: "Non procedere" },
] as const;

export type ParereValutazione = (typeof PARERI_VALUTAZIONE)[number]["value"];

export function labelParere(value?: string | null) {
  return PARERI_VALUTAZIONE.find((p) => p.value === value)?.label ?? value ?? "—";
}

export function labelTipoAzione(value?: string | null) {
  return TIPI_AZIONE_IPOTIZZATA.find((t) => t.value === value)?.label ?? value ?? "—";
}
