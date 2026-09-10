/** Tipi conferimento legale lotto (post-import). */

export const CONFERIMENTO_TIPI = [
  { value: "STRAGIUDIZIALE", label: "Solo stragiudiziale" },
  { value: "GIUDIZIALE", label: "Solo giudiziale" },
  { value: "ENTRAMBI", label: "Entrambi" },
] as const;

export type ConferimentoTipo = (typeof CONFERIMENTO_TIPI)[number]["value"];

export const PROSSIMA_ATTIVITA_PASSAGGIO_GIUDIZIALE =
  "Passaggio a fase giudiziale";

export function labelConferimentoTipo(tipo?: string | null) {
  const t = String(tipo || "").trim().toUpperCase();
  return CONFERIMENTO_TIPI.find((x) => x.value === t)?.label ?? (t || "Non impostato");
}

export function isConferimentoTipo(v: string): v is ConferimentoTipo {
  return CONFERIMENTO_TIPI.some((t) => t.value === v);
}

/** True solo se sul lotto/perimetro è previsto mandato giudiziale (o entrambi). */
export function isGiudizialePrevistoSulLotto(tipo?: string | null): boolean {
  const t = String(tipo || "").trim().toUpperCase();
  return t === "GIUDIZIALE" || t === "ENTRAMBI";
}

/** True se sul lotto è prevista attività stragiudiziale (o entrambi). Solo giudiziale = no. */
export function isStragiudizialePrevistoSulLotto(tipo?: string | null): boolean {
  const t = String(tipo || "").trim().toUpperCase();
  if (t === "GIUDIZIALE") return false;
  return true;
}
