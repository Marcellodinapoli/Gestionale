/**
 * Bridge client-only tra `onRouterTransitionStart` (instrumentation)
 * e PerfMonitor (React). Nessuno storage, nessun timer.
 */

export type PendingNavigation = {
  t0: number;
  url: string;
  navigationType: string;
};

let pending: PendingNavigation | null = null;

/** Pathname senza query/hash, per confronto con usePathname(). */
export function pathOnlyFromUrl(url: string): string {
  const raw = String(url || "").trim();
  if (!raw) return "/";
  try {
    if (raw.startsWith("http://") || raw.startsWith("https://")) {
      return new URL(raw).pathname || "/";
    }
  } catch {
    /* fallthrough */
  }
  const path = raw.split("?")[0]?.split("#")[0] || "/";
  return path.startsWith("/") ? path : `/${path}`;
}

export function setPendingNavigation(nav: PendingNavigation): void {
  pending = nav;
}

export function peekPendingNavigation(): PendingNavigation | null {
  return pending;
}

export function takePendingNavigation(): PendingNavigation | null {
  const cur = pending;
  pending = null;
  return cur;
}

export function clearPendingNavigation(): void {
  pending = null;
}
