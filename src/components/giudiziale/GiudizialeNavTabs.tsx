import { LegalPhaseNav, type LegalPhaseKey } from "@/components/giudiziale/LegalPhaseNav";

export type GiudizialeTabKey = "avvio" | "valutazione" | "strategia";

/** @deprecated hint legacy — la navigazione non blocca più. */
export function tabReachable(
  _key: GiudizialeTabKey | "panoramica",
  _statoAvvio?: string | null
): boolean {
  return true;
}

/** Tab fase giudiziale su pratica: stesse 4 voci del menu Legal. */
export function GiudizialeNavTabs({
  praticaId,
  attivo,
}: {
  praticaId: string;
  attivo: GiudizialeTabKey;
  /** @deprecated ignorato */
  statoAvvio?: string | null;
}) {
  const key: LegalPhaseKey = attivo;
  return <LegalPhaseNav attivo={key} praticaId={praticaId} />;
}
