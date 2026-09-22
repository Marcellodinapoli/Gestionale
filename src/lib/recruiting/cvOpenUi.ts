/** Helper UI apertura CV Indeed (messaggi utente, validazione URL). Nessuna persistenza. */

export function mapCvOpenUserMessage(raw: string): string {
  const msg = String(raw || "").trim();
  if (!msg) return "Operazione non riuscita";
  if (/non autorizz|accesso negato|permission|forbidden|403/i.test(msg)) {
    return msg;
  }
  if (
    /non raggiungibile|timeout|offline|impossibile raggiungere|ricevitore non (configurato|attivo|disponibile)/i.test(
      msg
    )
  ) {
    return "Impossibile raggiungere il sistema che conserva il CV.";
  }
  if (/cv non disponibile|senza riferimento receiver/i.test(msg)) {
    return "CV non disponibile.";
  }
  if (/non (è|e) più valido|url|collegamento|scadut|non valida/i.test(msg)) {
    return "Il collegamento al CV non è più valido. Riprova.";
  }
  if (/sincronizzazione non riuscita|ricevitore/i.test(msg)) {
    return "Impossibile raggiungere il sistema che conserva il CV.";
  }
  return msg;
}

export function formatOrigineCandidatura(
  source: string | null | undefined
): string | null {
  const raw = String(source || "").trim();
  if (!raw) return null;
  if (/^indeed$/i.test(raw)) return "Indeed";
  return raw;
}

export function isTemporaryCvUrlValid(
  openUrl: string,
  expiresAt?: string | null
): boolean {
  const url = String(openUrl || "").trim();
  if (!/^https?:\/\//i.test(url)) return false;
  if (expiresAt) {
    const exp = new Date(expiresAt).getTime();
    if (!Number.isNaN(exp) && exp < Date.now()) return false;
  }
  return true;
}
