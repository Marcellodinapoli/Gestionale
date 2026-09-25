/** Candidature già aperte in scheda (cache locale; fonte di verità = attività VISIONE). */

const STORAGE_PREFIX = "credixa:recruiting-candidature-viste:";
export const CANDIDATURE_VISTE_EVENT = "credixa:recruiting-candidature-viste";

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
    window.dispatchEvent(
      new CustomEvent(CANDIDATURE_VISTE_EVENT, { detail: { userId, candidaturaId } })
    );
  } catch {
    /* ignore quota / private mode */
  }
}

/** Unisce id già visti lato server con la cache locale. */
export function mergeCandidatureViste(
  userId: string,
  serverIds: readonly string[]
): Set<string> {
  const merged = listCandidatureViste(userId);
  for (const id of serverIds) {
    const trimmed = String(id || "").trim();
    if (trimmed) merged.add(trimmed);
  }
  if (typeof window !== "undefined" && serverIds.length > 0) {
    try {
      window.localStorage.setItem(
        candidatureVisteStorageKey(userId),
        JSON.stringify([...merged])
      );
    } catch {
      /* ignore */
    }
  }
  return merged;
}
