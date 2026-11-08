/** Chiavi vietate nel payload del chatbot assistenza (nessun dato operativo). */
export const GESTIONALE_HELP_FORBIDDEN_KEYS = [
  "praticaId",
  "practiceId",
  "practiceText",
  "debitoreId",
  "debitore",
  "codiceFiscale",
  "cf",
  "importo",
  "amount",
  "tenantData",
  "pratiche",
  "debitori",
] as const;

export function assertGestionaleHelpClientPayload(
  data: Record<string, unknown>,
): void {
  for (const key of Object.keys(data)) {
    const lower = key.toLowerCase();
    if (
      GESTIONALE_HELP_FORBIDDEN_KEYS.some((f) =>
        lower.includes(f.toLowerCase()),
      )
    ) {
      throw new Error("Payload non consentito per l'assistenza Credixa Suite.");
    }
  }
}
