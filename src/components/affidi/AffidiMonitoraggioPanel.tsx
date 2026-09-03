import { Suspense } from "react";

import { Card } from "@/components/ui";

import { DashboardKpi } from "@/components/home/DashboardStat";

import { buildPraticheQuery } from "@/components/PaginazioneBar";

import { AffidiMonitorFiltri } from "@/components/affidi/AffidiMonitorFiltri";

import type { AffidiMonitoraggioDto } from "@/lib/affidi/loadAffidiMonitoraggio";

import type { MandantePerimetriAffidi } from "@/lib/affidi/affidiMonitorPerimetri";

import type { AffidiNavParams } from "@/components/affidi/AffidiCaricoOperatori";

export function AffidiMonitoraggioPanel({
  mandanti,
  monitor,
  mandatoId,
  perimetro,
  extraParams,
}: {
  mandanti: MandantePerimetriAffidi[];
  monitor: AffidiMonitoraggioDto;
  mandatoId?: string;
  perimetro?: string;
  extraParams?: Pick<
    AffidiNavParams,
    "operatore" | "coda" | "sezione" | "caricoMandato" | "caricoPerimetro" | "caricoMese"
  >;
}) {
  const { nuove, nonAssegnate, inLavorazione, inScadenza7gg } = monitor;

  return (
    <Card title="Monitoraggio operativo">
      <p className="mb-3 text-xs text-[var(--muted)]">
        I filtri aggiornano allerte e l&apos;elenco pratiche da affidare sotto. Incassi e carico
        operatori hanno filtri separati in alto.
      </p>
      <Suspense fallback={null}>
        <AffidiMonitorFiltri
          mandanti={mandanti}
          mandatoId={mandatoId}
          perimetro={perimetro}
          extraParams={extraParams}
        />
      </Suspense>

      <div className="mt-4">
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
          Allerte
        </h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:gap-3">
          <DashboardKpi
            title="Nuove"
            value={nuove}
            hint="Pratiche nuove"
            href={buildPraticheQuery({
              stato: "NUOVA",
              ...(mandatoId ? { mandato: mandatoId } : {}),
              ...(perimetro ? { lotto: perimetro } : {}),
            })}
          />
          <DashboardKpi
            title="Non assegnate"
            value={nonAssegnate}
            hint="Pratiche aperte senza operatore"
          />
          <DashboardKpi
            title="In lavorazione"
            value={inLavorazione}
            hint="Pratiche in lavorazione"
            href={buildPraticheQuery({
              stato: "IN_LAVORAZIONE",
              ...(mandatoId ? { mandato: mandatoId } : {}),
              ...(perimetro ? { lotto: perimetro } : {}),
            })}
          />
          <DashboardKpi
            title="In scadenza 7 gg"
            value={inScadenza7gg}
            hint="Scadono entro una settimana"
          />
        </div>
      </div>
    </Card>
  );
}
