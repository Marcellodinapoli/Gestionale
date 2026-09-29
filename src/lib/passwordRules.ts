export const PASSWORD_MIN_LENGTH = 6;

export const PASSWORD_REQUIREMENTS =
  "Almeno 6 caratteri, una lettera maiuscola e un carattere speciale (!@#$…).";

/** Scadenza password: dopo questo periodo il login forza il cambio. */
export const PASSWORD_MAX_AGE_DAYS = 30;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

type DateLike = Date | string | null | undefined;

function toDate(value: DateLike): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** true se assente/null o più vecchia di PASSWORD_MAX_AGE_DAYS. */
export function isPasswordExpired(passwordChangedAt: DateLike) {
  const changedAt = toDate(passwordChangedAt);
  if (!changedAt) return true;
  return Date.now() - changedAt.getTime() >= PASSWORD_MAX_AGE_DAYS * MS_PER_DAY;
}

export function giorniAllaScadenzaPassword(passwordChangedAt: DateLike) {
  const changedAt = toDate(passwordChangedAt);
  if (!changedAt) return 0;
  const expiresAt = changedAt.getTime() + PASSWORD_MAX_AGE_DAYS * MS_PER_DAY;
  return Math.max(0, Math.ceil((expiresAt - Date.now()) / MS_PER_DAY));
}

/** Restituisce il messaggio d'errore oppure null se la password è valida. */
export function validatePasswordComplexity(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `La password deve avere almeno ${PASSWORD_MIN_LENGTH} caratteri`;
  }
  if (!/[A-Z]/.test(password)) {
    return "La password deve contenere almeno una lettera maiuscola";
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return "La password deve contenere almeno un carattere speciale";
  }
  return null;
}
