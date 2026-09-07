/** URL da cui si è entrati in una scheda pratica (es. /affidi?… con filtri/ordine). */
export const PRATICHE_BACK_KEY = "credixa:pratiche-back";

function isPratichePath(pathname: string) {
  return pathname === "/pratiche" || pathname.startsWith("/pratiche/");
}

/** Salva la pagina corrente come destinazione del ← in nav Pratiche. */
export function rememberCurrentAsPraticheBack() {
  if (typeof window === "undefined") return;
  try {
    const pathname = window.location.pathname;
    if (isPratichePath(pathname)) return;
    const qs = window.location.search.replace(/^\?/, "");
    const full = qs ? `${pathname}?${qs}` : pathname;
    sessionStorage.setItem(PRATICHE_BACK_KEY, full);
  } catch {
    /* ignore */
  }
}

export function readPraticheBackHref(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return sessionStorage.getItem(PRATICHE_BACK_KEY);
  } catch {
    return null;
  }
}
