"use client";

import { useEffect } from "react";
import { prefetchPraticaExtraIdle } from "@/lib/praticaExtraClient";

/** Prefetch note/contabile in idle time senza rendere server la scheda pratica. */
export function PraticaExtraPrefetch({ praticaId }: { praticaId: string }) {
  useEffect(() => {
    prefetchPraticaExtraIdle(praticaId);
  }, [praticaId]);
  return null;
}
