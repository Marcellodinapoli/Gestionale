/** Allineato alla durata del cookie di sessione (createSession → 12h). */
export const SESSION_PRESENCE_MAX_MS = 12 * 60 * 60 * 1000;

/** True se lastLoginAt è successivo a lastLogoutAt (sessione aperta) e non scaduta. */
export function isUserSessionActive(u: {
  lastLoginAt?: Date | string | null;
  lastLogoutAt?: Date | string | null;
}): boolean {
  if (!u.lastLoginAt) return false;
  const login = new Date(u.lastLoginAt).getTime();
  if (Number.isNaN(login)) return false;
  // Senza logout (chiusura browser senza beacon) non restare "online" oltre la sessione.
  if (Date.now() - login > SESSION_PRESENCE_MAX_MS) return false;
  if (!u.lastLogoutAt) return true;
  const logout = new Date(u.lastLogoutAt).getTime();
  if (Number.isNaN(logout)) return true;
  return login > logout;
}

export type DeskOccupant = {
  id?: string;
  name?: string | null;
  cognome?: string | null;
  role?: string | null;
  postazioneFissa?: boolean | null;
  lastLoginAt?: Date | string | null;
  lastLogoutAt?: Date | string | null;
};

export function formatUtenteNome(u: {
  name?: string | null;
  cognome?: string | null;
}): string {
  return [u.name, u.cognome].filter(Boolean).join(" ").trim() || String(u.name || "—");
}

/** Occupanti che bloccano davvero la postazione (sessione aperta o fissa operativa). */
export function blockingOccupants<T extends DeskOccupant>(occupanti: T[]): T[] {
  return occupanti.filter(occupantBlocksDesk);
}

/**
 * Blocca la postazione se sessione aperta, oppure postazione fissa (ruoli operativi).
 * Admin/amministrazione con fissa ma fuori sessione non bloccano (evita residui su desk condivisi).
 * Se i campi sessione non sono disponibili (API legacy), si considera occupata.
 */
export function occupantBlocksDesk(o: DeskOccupant): boolean {
  const hasSessionFields =
    o.lastLoginAt !== undefined ||
    o.lastLogoutAt !== undefined ||
    o.postazioneFissa !== undefined;
  if (!hasSessionFields) return true;
  if (isUserSessionActive(o)) return true;
  if (!o.postazioneFissa) return false;
  const role = String(o.role ?? "").toUpperCase();
  if (role === "ADMIN" || role === "AMMINISTRAZIONE") return false;
  return true;
}

type PostazioneVisibileInput = DeskOccupant & {
  interno?: string | null;
  postazioneId?: string | null;
  postazioneInterno?: string | null;
  postazioneEmail?: string | null;
  postazioneNome?: string | null;
};

/** Stessa regola della rubrica: interno/postazione solo se desk attivo. */
export function resolvePostazioneVisibile(u: PostazioneVisibileInput): {
  interno: string | null;
  email: string | null;
  nome: string | null;
} {
  if (!u.postazioneId) {
    return { interno: null, email: null, nome: null };
  }
  if (!occupantBlocksDesk(u)) {
    return { interno: null, email: null, nome: null };
  }
  return {
    interno: u.postazioneInterno?.trim() || u.interno?.trim() || null,
    email: u.postazioneEmail?.trim() || null,
    nome: u.postazioneNome?.trim() || null,
  };
}
