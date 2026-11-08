import { DashboardKpi } from "@/components/home/DashboardStat";
import type { AffidiMonitoraggioDto } from "@/lib/affidi/loadAffidiMonitoraggio";
import {
  buildAffidiHref,
  type AffidiAllertaNav,
  type AffidiNavParams,
} from "@/components/affidi/AffidiCaricoOperatori";

export function AffidiAllerteCards({
  monitor,
  mandatoId,
  perimetro,
  allertaAttiva,
  extraParams,
  layoutBackOffice = false,
  filtroLabel,
}: {
  monitor: AffidiMonitoraggioDto;
  mandatoId?: string;
  perimetro?: string;
  allertaAttiva?: AffidiAllertaNav;
  layoutBackOffice?: boolean;
  filtroLabel?: string;
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
  const {
    nonAssegnate,
    inLavorazione,
    inScadenza7gg,
    inFaseGiudiziale = 0,
    giudizialiDaAffidare = 0,
  } = monitor;

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
    <section aria-label="Allerte">
      <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
        Allerte
      </h2>
      {filtroLabel ? (
        <p className="mb-2 text-xs text-[var(--muted)]">
          Riepilogo per: <span className="font-medium text-[var(--navy)]">{filtroLabel}</span>
        </p>
      ) : null}
      <div
        className={
          layoutBackOffice
            ? "grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5 lg:gap-3"
            : "grid grid-cols-2 gap-2 sm:grid-cols-3 lg:gap-3"
        }
      >
        <DashboardKpi
          title="Da affidare"
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
        {layoutBackOffice ? (
          <>
            <DashboardKpi
              title="In fase giudiziale"
              value={inFaseGiudiziale}
              hint="Giudiziale attivo o stragiudiziale scaduto"
              href={hrefAllerta("in_fase_giudiziale")}
            />
            <DashboardKpi
              title="Giudiziali da affidare"
              value={giudizialiDaAffidare}
              hint="Giudiziali senza affidatario"
              href={hrefAllerta("giudiziali_da_affidare")}
            />
          </>
        ) : null}
      </div>
    </section>
  );
}