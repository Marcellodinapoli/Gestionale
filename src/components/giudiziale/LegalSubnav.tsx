import { LegalPhaseNav } from "@/components/giudiziale/LegalPhaseNav";

/** Compatibilità: stessa navigazione unificata del menu Legal. */
export function LegalSubnav({
  attivo,
}: {
  attivo: "hub" | "valutazione" | "strategia" | "avvio";
}) {
  const map = {
    hub: "panoramica" as const,
    avvio: "avvio" as const,
    valutazione: "valutazione" as const,
    strategia: "strategia" as const,
  };
  return <LegalPhaseNav attivo={map[attivo]} />;
}
