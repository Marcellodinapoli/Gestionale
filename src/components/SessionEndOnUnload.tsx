"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * Alla chiusura tab/finestra registra logout e invalida la sessione.
 * Ignora navigazioni interne (Link, router.push, history) e bfcache:
 * altrimenti pagehide durante l'apertura di una pratica cancellerebbe
 * il cookie e sembrerebbe un logout.
 */
export function SessionEndOnUnload() {
  const pathname = usePathname();
  const inAppNavUntilRef = useRef(0);

  useEffect(() => {
    if (
      pathname === "/login" ||
      pathname.startsWith("/login/") ||
      pathname === "/attiva-account" ||
      pathname.startsWith("/attiva-account/")
    ) {
      return;
    }

    const markInAppNav = () => {
      inAppNavUntilRef.current = Date.now() + 5_000;
    };

    const endSession = () => {
      try {
        if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
          // Blob con type → POST esplicito (niente GET accidentale).
          navigator.sendBeacon(
            "/api/auth/logout",
            new Blob([""], { type: "application/json" })
          );
          return;
        }
      } catch {
        /* ignore */
      }
      try {
        void fetch("/api/auth/logout", {
          method: "POST",
          credentials: "same-origin",
          keepalive: true,
        });
      } catch {
        /* ignore */
      }
    };

    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const href = a.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
        return;
      }
      try {
        const url = new URL(href, window.location.href);
        if (url.origin !== window.location.origin) return;
      } catch {
        return;
      }
      markInAppNav();
    };

    const onPageHide = (e: PageTransitionEvent) => {
      if (e.persisted) return;
      if (Date.now() < inAppNavUntilRef.current) return;
      endSession();
    };

    const origPush = history.pushState.bind(history);
    const origReplace = history.replaceState.bind(history);
    history.pushState = ((...args: Parameters<History["pushState"]>) => {
      markInAppNav();
      return origPush(...args);
    }) as History["pushState"];
    history.replaceState = ((...args: Parameters<History["replaceState"]>) => {
      markInAppNav();
      return origReplace(...args);
    }) as History["replaceState"];

    document.addEventListener("click", onClick, true);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("popstate", markInAppNav);

    return () => {
      history.pushState = origPush;
      history.replaceState = origReplace;
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("popstate", markInAppNav);
    };
  }, [pathname]);

  return null;
}
