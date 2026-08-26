"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Precarica le rotte di navigazione più usate (App Router). */
const DEFAULT_ROUTES = ["/", "/pratiche", "/agenda", "/messaggi", "/lavorazione"];

export function NavPrefetch({ routes = DEFAULT_ROUTES }: { routes?: string[] }) {
  const router = useRouter();
  useEffect(() => {
    for (const href of routes) {
      try {
        router.prefetch(href);
      } catch {
        /* ignore */
      }
    }
  }, [router, routes]);
  return null;
}
