/** Candidature già aperte in scheda (tab «Nuove» per utente). */

const STORAGE_PREFIX = "credixa:recruiting-candidature-viste:";

export function candidatureVisteStorageKey(userId: string) {
  return `${STORAGE_PREFIX}${userId || "anonymous"}`;
}

export function listCandidatureViste(userId: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(candidatureVisteStorageKey(userId));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id): id is string => typeof id === "string" && id.length > 0));
  } catch {
    return new Set();
  }
}

export function isCandidaturaVista(userId: string, candidaturaId: string): boolean {
  return listCandidatureViste(userId).has(candidaturaId);
}

export function markCandidaturaVista(userId: string, candidaturaId: string) {
  if (typeof window === "undefined" || !candidaturaId) return;
  try {
    const next = listCandidatureViste(userId);
    if (next.has(candidaturaId)) return;
    next.add(candidaturaId);
    window.localStorage.setItem(
      candidatureVisteStorageKey(userId),
      JSON.stringify([...next])
    );
  } catch {
    /* ignore quota / private mode */
  }
}
