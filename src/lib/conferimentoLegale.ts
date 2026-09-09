/** Tipi conferimento legale lotto (post-import). */

export const CONFERIMENTO_TIPI = [
  { value: "STRAGIUDIZIALE", label: "Solo stragiudiziale" },
  { value: "GIUDIZIALE", label: "Solo giudiziale" },
  { value: "ENTRAMBI", label: "Entrambi" },
] as const;

export type ConferimentoTipo = (typeof CONFERIMENTO_TIPI)[number]["value"];

export const PROSSIMA_ATTIVITA_PASSAGGIO_GIUDIZIALE =
  "Passaggio a fase giudiziale";

export function isConferimentoTipo(v: string): v is ConferimentoTipo {
  return CONFERIMENTO_TIPI.some((t) => t.value === v);
}

/** False solo se il lotto è esplicitamente «solo stragiudiziale». */
export function isGiudizialePrevistoSulLotto(tipo?: string | null): boolean {
  if (tipo == null || tipo === "") return true;
  return tipo === "GIUDIZIALE" || tipo === "ENTRAMBI";
}
