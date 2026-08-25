import type { SessionUser } from "@/lib/permissions";

export function isFormazioneOnly(user: { formazioneOnly?: boolean } | null | undefined) {
  return Boolean(user?.formazioneOnly);
}

/** Percorsi consentiti agli account solo formazione. */
export function isFormazioneOnlyPath(pathname: string) {
  return pathname === "/account" || pathname.startsWith("/formazione");
}

export function homePathForUser(user: SessionUser) {
  return isFormazioneOnly(user) ? "/formazione/progressi" : "/";
}

export function assertFormazioneOnlyPath(user: SessionUser, pathname: string) {
  if (isFormazioneOnly(user) && !isFormazioneOnlyPath(pathname)) {
    return homePathForUser(user);
  }
  return null;
}
