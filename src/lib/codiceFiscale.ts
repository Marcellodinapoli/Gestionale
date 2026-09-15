/** Normalizza codice fiscale (senza dipendenze server). */
export function normalizeCf(value?: string | null) {
  return (value || "").replace(/[\s]/g, "").toUpperCase();
}

const CF_MESI: Record<string, number> = {
  A: 1,
  B: 2,
  C: 3,
  D: 4,
  E: 5,
  H: 6,
  L: 7,
  M: 8,
  P: 9,
  R: 10,
  S: 11,
  T: 12,
};

export type DataNascitaCf = {
  giorno: number;
  mese: number;
  anno: number;
};

/** Ricava l'anno di nascita dalle cifre 7-8 del codice fiscale italiano. */
export function annoNascitaDaCodiceFiscale(cf: string | null | undefined): number | null {
  return dataNascitaDaCodiceFiscale(cf)?.anno ?? null;
}

/** Giorno / mese / anno di nascita dal codice fiscale italiano. */
export function dataNascitaDaCodiceFiscale(
  cf: string | null | undefined
): DataNascitaCf | null {
  const normalized = normalizeCf(cf);
  if (normalized.length < 11) return null;

  const yy = Number(normalized.slice(6, 8));
  if (Number.isNaN(yy)) return null;
  const currentYY = new Date().getFullYear() % 100;
  const anno = (yy > currentYY ? 1900 : 2000) + yy;

  const mese = CF_MESI[normalized.charAt(8)];
  if (!mese) return null;

  let giorno = Number(normalized.slice(9, 11));
  if (Number.isNaN(giorno)) return null;
  if (giorno > 40) giorno -= 40; // femminile
  if (giorno < 1 || giorno > 31) return null;

  return { giorno, mese, anno };
}

/** Età anagrafica alla data di riferimento (default: oggi). */
export function etaDaDataNascita(
  nascita: DataNascitaCf | null | undefined,
  oggi: Date = new Date()
): number | null {
  if (!nascita) return null;
  let eta = oggi.getFullYear() - nascita.anno;
  const m = oggi.getMonth() + 1;
  const d = oggi.getDate();
  if (m < nascita.mese || (m === nascita.mese && d < nascita.giorno)) {
    eta -= 1;
  }
  return eta >= 0 ? eta : null;
}

export function formatGiornoMese(n: number): string {
  return String(n).padStart(2, "0");
}
