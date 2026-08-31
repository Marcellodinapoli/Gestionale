/** Normalizza codice fiscale (senza dipendenze server). */
export function normalizeCf(value?: string | null) {
  return (value || "").replace(/[\s]/g, "").toUpperCase();
}

/** Ricava l'anno di nascita dalle cifre 7-8 del codice fiscale italiano. */
export function annoNascitaDaCodiceFiscale(cf: string | null | undefined): number | null {
  const normalized = normalizeCf(cf);
  if (normalized.length < 8) return null;
  const yy = Number(normalized.slice(6, 8));
  if (Number.isNaN(yy)) return null;
  const currentYY = new Date().getFullYear() % 100;
  return (yy > currentYY ? 1900 : 2000) + yy;
}
