/** Modalità incasso: verificato (conteggia in provvigione). */
export const MODO_INCASSO_VERIFICATO = "ve";

/** Modalità incasso: non provvigioneabile. */
export const MODO_INCASSO_NON_PROVV = "np";

export const MODI_INCASSO_PROVV = [
  { value: MODO_INCASSO_VERIFICATO, label: "ve — Verificato" },
  { value: MODO_INCASSO_NON_PROVV, label: "np — Non provvigioneabile" },
] as const;

export function normalizeModoIncasso(raw?: string | null) {
  const v = String(raw || "")
    .trim()
    .toLowerCase();
  if (v === MODO_INCASSO_NON_PROVV) return MODO_INCASSO_NON_PROVV;
  return MODO_INCASSO_VERIFICATO;
}

export function isModoNonProvvigionabile(modo?: string | null) {
  return normalizeModoIncasso(modo) === MODO_INCASSO_NON_PROVV;
}

/** @deprecated usa isModoNonProvvigionabile */
export const FATTURA_NON_PROVVIGIONABILE = MODO_INCASSO_NON_PROVV;

export function normalizeFatturaIncasso(raw?: string | null) {
  return String(raw || "").trim();
}

/** @deprecated usa isModoNonProvvigionabile(modo) */
export function isFatturaNonProvvigionabile(fatturaOrModo?: string | null) {
  return isModoNonProvvigionabile(fatturaOrModo);
}
