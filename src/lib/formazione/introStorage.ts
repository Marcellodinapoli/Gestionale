const STORAGE_PREFIX = "credixa:formazione-intro-seen:";

export function formazioneIntroStorageKey(userKey: string) {
  return `${STORAGE_PREFIX}${userKey || "anonymous"}`;
}

export function hasSeenFormazioneIntro(userKey: string): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(formazioneIntroStorageKey(userKey)) === "1";
  } catch {
    return true;
  }
}

export function markFormazioneIntroSeen(userKey: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(formazioneIntroStorageKey(userKey), "1");
  } catch {
    /* ignore quota / private mode */
  }
}
