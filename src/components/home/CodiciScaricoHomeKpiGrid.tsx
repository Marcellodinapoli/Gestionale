import Link from "next/link";
import {
  COLONNE_CODICI,
  emptyConteggi,
  type RigaCodiciMandantePerimetro,
} from "@/lib/codiciMandantePerimetroUi";
import { buildPraticheQuery } from "@/components/PaginazioneBar";
import type { CodiceConteggioKey } from "@/lib/codiciMandantePerimetroUi";
import { CODICE_SCARICO_LABELS, type CodiceScarico } from "@/lib/scarico";
import {
  dashboardKpiAccentClass,
  dashboardKpiBase,
  type DashboardKpiAccent,
} from "@/components/home/DashboardStat";

const CODICE_ACCENT: Record<CodiceConteggioKey, DashboardKpiAccent> = {
  PTC: "accent",
  PPC: "accent",
  MOV: "amber",
  LPP: "accent",
  LPT: "accent",
  ND: "slate",
};

function totaliPerCodice(righe: RigaCodiciMandantePerimetro[]) {
  const totals = emptyConteggi();
  for (const r of righe) {
    for (const col of COLONNE_CODICI) {
      totals[col.key] += r.conteggi[col.key] ?? 0;
    }
  }
  return totals;
}

export function CodiciScaricoHomeKpiGrid({
  righe,
}: {
  righe: RigaCodiciMandantePerimetro[];
}) {
  const totals = totaliPerCodice(righe);
  const totalePratiche = righe.reduce((s, r) => s + r.totale, 0);

  if (!totalePratiche) {
    return (
      <section
        className={`${dashboardKpiBase} ${dashboardKpiAccentClass("slate")}`.trim()}
      >
        <p className="text-sm text-[var(--muted)]">Nessuna pratica da riepilogare.</p>
      </section>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6 lg:gap-3">
      {COLONNE_CODICI.map((col) => {
        const count = totals[col.key];
        const href = buildPraticheQuery({
          ...(col.key === "ND" ? { codScarico: "NULL" } : { codScarico: col.key }),
        });
        const hint =
          col.key !== "ND"
            ? CODICE_SCARICO_LABELS[col.key as CodiceScarico]
            : undefined;

        return (
          <Link
            key={col.key}
            href={href}
            className={`${dashboardKpiBase} ${dashboardKpiAccentClass(CODICE_ACCENT[col.key])}`.trim()}
          >
            <p className="truncate text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
              {col.label}
            </p>
            <p className="mt-0.5 tabular-nums text-2xl font-bold leading-tight text-[var(--navy)]">
              {count}
            </p>
            {hint ? (
              <p className="mt-0.5 truncate text-[11px] text-[var(--muted)]">{hint}</p>
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}
