import { DashboardKpi } from "@/components/home/DashboardStat";
import type { HomeGiudizialeStragiudKpi } from "@/lib/homeKpi/loadHomeGiudizialeStragiud";

export function HomeGiudizialeStragiudCards({
  kpi,
}: {
  kpi: HomeGiudizialeStragiudKpi;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-2 lg:gap-3">
      <DashboardKpi
        title="Scad. stragiudiziale"
        value={kpi.preavvisoCount}
        href={kpi.preavvisoHref}
        hint={`Entro ${kpi.preavvisoGgLavorativi} gg lavorativi o già scadute`}
      />
      <DashboardKpi
        title="In attività giudiziale"
        value={kpi.attivitaGiudizialeCount}
        href={kpi.attivitaGiudizialeHref}
        hint="Valutazione / strategia in corso"
      />
    </div>
  );
}
