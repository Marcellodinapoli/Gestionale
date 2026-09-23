"use client";

import { usePathname } from "next/navigation";
import { LegalPhaseNav, type LegalPhaseKey } from "@/components/giudiziale/LegalPhaseNav";

export function LegalHubNav() {
  const pathname = usePathname();
  let attivo: LegalPhaseKey = "panoramica";
  if (pathname.startsWith("/legal/valutazione")) attivo = "valutazione";
  else if (pathname.startsWith("/legal/strategia")) attivo = "strategia";
  else if (pathname.startsWith("/legal/agenda")) attivo = "agenda";
  return <LegalPhaseNav attivo={attivo} />;
}
