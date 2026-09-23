/** Messaggi Firebase tipo `internal` / `internal[0]` → testo leggibile. */
export function formatFirebaseFunctionsError(error: unknown): string {
  const raw =
    error && typeof error === "object"
      ? String(
          (error as { message?: string }).message ??
            (error as { code?: string }).code ??
            error
        )
      : String(error ?? "");
  const compact = raw.replace(/^FirebaseError:\s*/i, "").trim();
  if (
    /^internal(\[\d+\])?$/i.test(compact) ||
    compact.includes("functions/internal") ||
    compact.includes("functions/not-found") ||
    compact.includes("functions/unavailable")
  ) {
    return "Motore AI CreditForm non disponibile";
  }
  return compact || "Valutazione non riuscita";
}
