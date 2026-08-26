"use client";

import { useCallback, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

/** Route pesanti: evita soft-refresh periodico (restano i refresh su focus). */
function isHeavyRoute(pathname: string) {
  return (
    pathname.startsWith("/affidi") ||
    pathname.startsWith("/provigioni") ||
    // Scheda pratica + sottopagine contabili/stampa: refresh periodico
    // rifà l’include pesante e rende lente F6–F11 / popup strumenti.
    /^\/pratiche\/[^/]+/.test(pathname)
  );
}

/**
 * Soft-refresh: al focus finestra e ogni N secondi richiama router.refresh()
 * senza navigazione completa — stato client preservato dove possibile.
 */
export function SoftRefresh({
  intervalMs = 180_000,
  onFocus = true,
}: {
  intervalMs?: number;
  onFocus?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const last = useRef(0);
  const skipInterval = isHeavyRoute(pathname || "");

  const refresh = useCallback(() => {
    const now = Date.now();
    if (now - last.current < 8_000) return;
    last.current = now;
    router.refresh();
  }, [router]);

  useEffect(() => {
    if (intervalMs <= 0 || skipInterval) return;
    const id = setInterval(refresh, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, refresh, skipInterval]);

  useEffect(() => {
    if (!onFocus || skipInterval) return;
    function onVis() {
      if (document.visibilityState === "visible") refresh();
    }
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", refresh);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", refresh);
    };
  }, [onFocus, refresh, skipInterval]);

  return null;
}
