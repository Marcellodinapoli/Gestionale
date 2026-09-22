"use client";

import { useEffect } from "react";
import { markCandidaturaVista } from "@/lib/recruiting/candidatureVisteStorage";

/** Segna la candidatura come visualizzata (esce dal tab «Nuove»). */
export function MarkCandidaturaVista({
  userId,
  candidaturaId,
}: {
  userId: string;
  candidaturaId: string;
}) {
  useEffect(() => {
    markCandidaturaVista(userId, candidaturaId);
  }, [userId, candidaturaId]);

  return null;
}
