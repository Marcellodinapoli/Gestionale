"use client";

import { useEffect } from "react";
import { markCandidaturaVistaAction } from "@/actions/recruiting";
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
    void markCandidaturaVistaAction(candidaturaId).catch(() => {
      /* rete / sessione: resta il flag locale */
    });
  }, [userId, candidaturaId]);

  return null;
}
