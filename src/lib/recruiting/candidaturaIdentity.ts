/**
 * Confronto sicuro candidature multi-canale (Indeed vs Creditplanet).
 * Nessun match su solo nome/cognome.
 */

/** Email confrontabile: lowercase, trim, formato base. */
export function normalizeEmailForMatch(
  value: string | null | undefined
): string | null {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw || raw.length > 200) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) return null;
  return raw;
}

/**
 * Telefono confrontabile: solo cifre, strip prefisso IT 39 se presente,
 * almeno 9 cifre (evita match su numeri corti).
 */
export function normalizePhoneForMatch(
  value: string | null | undefined
): string | null {
  let digits = String(value || "").replace(/\D+/g, "");
  if (!digits) return null;
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("39") && digits.length >= 11) {
    digits = digits.slice(2);
  }
  if (digits.length < 9 || digits.length > 15) return null;
  return digits;
}

export type ContactMatchInput = {
  email?: string | null;
  phone?: string | null;
};

export type ContactMatchCandidate = {
  id: string;
  email?: string | null;
  phone?: string | null;
};

export type ContactMatchReason = "email" | "phone";

/**
 * Decide se due contatti sono la stessa persona in modo conservativo.
 * - Email valida uguale → match
 * - Telefono normalizzato uguale + (entrambe le email assenti OPPURE uguali) → match
 * - Nome non usato
 */
export function contactsLikelySamePerson(
  a: ContactMatchInput,
  b: ContactMatchInput
): ContactMatchReason | null {
  const emailA = normalizeEmailForMatch(a.email);
  const emailB = normalizeEmailForMatch(b.email);
  if (emailA && emailB && emailA === emailB) return "email";

  const phoneA = normalizePhoneForMatch(a.phone);
  const phoneB = normalizePhoneForMatch(b.phone);
  if (!phoneA || !phoneB || phoneA !== phoneB) return null;

  // Telefono uguale: ok solo se non c'è conflitto email
  if (emailA && emailB && emailA !== emailB) return null;
  return "phone";
}

/** Prima candidatura sulla stessa offerta che matcha i contatti in ingresso. */
export function pickContactDuplicate(
  incoming: ContactMatchInput,
  candidates: ContactMatchCandidate[]
): { id: string; reason: ContactMatchReason } | null {
  for (const c of candidates) {
    const reason = contactsLikelySamePerson(incoming, c);
    if (reason) return { id: c.id, reason };
  }
  return null;
}
