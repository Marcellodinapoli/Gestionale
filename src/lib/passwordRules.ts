export const PASSWORD_MIN_LENGTH = 6;

export const PASSWORD_REQUIREMENTS =
  "Almeno 6 caratteri, una lettera maiuscola e un carattere speciale (!@#$…).";

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
