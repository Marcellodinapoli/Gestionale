import Link from "next/link";
import { ClipboardCheck, LayoutDashboard, PlayCircle, Waypoints } from "lucide-react";
import { SectionTabNav, sectionTabClass } from "@/components/ui/SectionTabNav";

export type LegalPhaseKey = "panoramica" | "avvio" | "valutazione" | "strategia";

const LABELS: Record<LegalPhaseKey, string> = {
  panoramica: "Panoramica",
  avvio: "Avvio",
  valutazione: "Valutazione",
  strategia: "Strategia",
};

const ICONS: Record<LegalPhaseKey, typeof LayoutDashboard> = {
  panoramica: LayoutDashboard,
  avvio: PlayCircle,
  valutazione: ClipboardCheck,
  strategia: Waypoints,
};

const HUB_HREFS: Record<Exclude<LegalPhaseKey, "avvio">, string> = {
  panoramica: "/legal",
  valutazione: "/legal/valutazione",
  strategia: "/legal/strategia",
};

function praticaHref(praticaId: string, key: LegalPhaseKey): string {
  switch (key) {
    case "panoramica":
      return "/legal";
    case "avvio":
      return `/pratiche/${praticaId}/avvio-giudiziale`;
    case "valutazione":
      return `/pratiche/${praticaId}/valutazione-legale`;
    case "strategia":
      return `/pratiche/${praticaId}/strategia-giudiziale`;
  }
}

/** Da menu Legal: senza Avvio (si avvia solo dalla pratica). */
const ORDER_HUB: Exclude<LegalPhaseKey, "avvio">[] = [
  "panoramica",
  "valutazione",
  "strategia",
];

/** Da pratica: include Avvio. */
const ORDER_PRATICA: LegalPhaseKey[] = [
  "panoramica",
  "avvio",
  "valutazione",
  "strategia",
];

/**
 * Navigazione fase Legal.
 * Avvio compare solo nel contesto pratica (dopo «Avvia giudiziale»).
 */
export function LegalPhaseNav({
  attivo,
  praticaId,
}: {
  attivo: LegalPhaseKey;
  /** Se valorizzato, Avvio/Valutazione/Strategia puntano alla pratica corrente. */
  praticaId?: string;
}) {
  const keys = praticaId ? ORDER_PRATICA : ORDER_HUB;
  return (
    <SectionTabNav label="Sezioni Legal" flush={Boolean(praticaId)}>
      {keys.map((key) => {
        const on = key === attivo;
        const href = praticaId
          ? praticaHref(praticaId, key)
          : HUB_HREFS[key as Exclude<LegalPhaseKey, "avvio">];
        const Icon = ICONS[key];
        if (on) {
          return (
            <span
              key={key}
              className={sectionTabClass(true)}
              aria-current="page"
            >
              <Icon className="h-4 w-4 shrink-0 opacity-80" />
              {LABELS[key]}
            </span>
          );
        }
        return (
          <Link key={key} href={href} className={sectionTabClass(false)}>
            <Icon className="h-4 w-4 shrink-0 opacity-80" />
            {LABELS[key]}
          </Link>
        );
      })}
    </SectionTabNav>
  );
}
