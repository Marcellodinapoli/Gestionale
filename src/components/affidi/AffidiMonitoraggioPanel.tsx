import { Suspense } from "react";

import { Card } from "@/components/ui";

import { DashboardKpi } from "@/components/home/DashboardStat";

import { AffidiMonitorFiltri } from "@/components/affidi/AffidiMonitorFiltri";

import type { AffidiMonitoraggioDto } from "@/lib/affidi/loadAffidiMonitoraggio";

import type { MandantePerimetriAffidi } from "@/lib/affidi/affidiMonitorPerimetri";

import {
  buildAffidiHref,
  type AffidiAllertaNav,
  type AffidiNavParams,
} from "@/components/affidi/AffidiCaricoOperatori";

export function AffidiMonitoraggioPanel({
  mandanti,
  monitor,
  mandatoId,
  perimetro,
  allertaAttiva,
  searchActive,
  extraParams,
}: {
  mandanti: MandantePerimetriAffidi[];
  monitor: AffidiMonitoraggioDto;
  mandatoId?: string;
  perimetro?: string;
  allertaAttiva?: AffidiAllertaNav;
  searchActive?: boolean;
  extraParams?: Pick<
    AffidiNavParams,
    | "operatore"
    | "coda"
    | "sezione"
    | "caricoMandato"
    | "caricoPerimetro"
    | "caricoMese"
    | "caricoCerca"
  >;
}) {
  const { nuove, nonAssegnate, inLavorazione, inScadenza7gg } = monitor;

  function hrefAllerta(allerta: AffidiAllertaNav) {
    const same = allertaAttiva === allerta;
    return buildAffidiHref({
      ...extraParams,
      mandato: mandatoId,
      perimetro,
      sezione: "affida",
      affidaCerca: same ? undefined : "1",
      allerta: same ? undefined : allerta,
    });
  }

  return (
    <Card title="Monitoraggio operativo">
      <p className="mb-3 text-xs text-[var(--muted)]">
        Imposta mandato/perimetro e premi Filtra per l&apos;elenco Affida sotto. Clic su una card
        allerta: apre lo stesso elenco filtrato.
      </p>
      <Suspense fallback={null}>
        <AffidiMonitorFiltri
          mandanti={mandanti}
          mandatoId={mandatoId}
          perimetro={perimetro}
          searchActive={searchActive}
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
            hint="Aperte senza codice scarico"
            href={hrefAllerta("nuove")}
          />
          <DashboardKpi
            title="Non assegnate"
            value={nonAssegnate}
            hint="Aperte senza affidatario"
            href={hrefAllerta("non_assegnate")}
          />
          <DashboardKpi
            title="In lavorazione"
            value={inLavorazione}
            hint="Pratiche in lavorazione"
            href={hrefAllerta("in_lavorazione")}
          />
          <DashboardKpi
            title="In scadenza 7 gg"
            value={inScadenza7gg}
            hint="Scadono entro una settimana"
            href={hrefAllerta("in_scadenza")}
          />
        </div>
      </div>
    </Card>
  );
}
