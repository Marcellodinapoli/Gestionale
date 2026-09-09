import Link from "next/link";

export type LegalPhaseKey = "panoramica" | "avvio" | "valutazione" | "strategia";

const LABELS: Record<LegalPhaseKey, string> = {
  panoramica: "Panoramica",
  avvio: "Avvio",
  valutazione: "Valutazione",
  strategia: "Strategia",
};

const HUB_HREFS: Record<LegalPhaseKey, string> = {
  panoramica: "/legal",
  avvio: "/legal/avvio",
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

const ORDER: LegalPhaseKey[] = [
  "panoramica",
  "avvio",
  "valutazione",
  "strategia",
];

/**
 * Navigazione unica fase Legal — stesse 4 sezioni da menu e da pratica.
 */
export function LegalPhaseNav({
  attivo,
  praticaId,
}: {
  attivo: LegalPhaseKey;
  /** Se valorizzato, Avvio/Valutazione/Strategia puntano alla pratica corrente. */
  praticaId?: string;
}) {
  return (
    <nav
      className="flex flex-wrap gap-1 rounded-lg border border-[var(--line)] bg-[#dce4ec] p-1"
      aria-label="Sezioni Legal"
    >
      {ORDER.map((key) => {
        const on = key === attivo;
        const href = praticaId ? praticaHref(praticaId, key) : HUB_HREFS[key];
        if (on) {
          return (
            <span
              key={key}
              className="rounded-md bg-[var(--navy)] px-3 py-2 text-sm font-bold text-white"
              aria-current="page"
            >
              {LABELS[key]}
            </span>
          );
        }
        return (
          <Link
            key={key}
            href={href}
            className="rounded-md px-3 py-2 text-sm font-semibold text-[var(--navy)] hover:bg-white"
          >
            {LABELS[key]}
          </Link>
        );
      })}
    </nav>
  );
}
