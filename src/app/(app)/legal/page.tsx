import Link from "next/link";
import { requirePermission } from "@/lib/guard";
import { Card, PageHeader } from "@/components/ui";
import { LegalPhaseNav } from "@/components/giudiziale/LegalPhaseNav";
import { listPraticheGiudiziali } from "@/lib/giudiziale/praticaGiudizialeRepo";
import { ATTIVITA_GIUDIZIALE_PARAM } from "@/lib/giudiziale/avvioGiudiziale";
import { loadHomeGiudizialeStragiudKpi } from "@/lib/homeKpi/loadHomeGiudizialeStragiud";
import { HomeGiudizialeStragiudCards } from "@/components/home/HomeGiudizialeStragiudCards";

export default async function LegalPage() {
  const user = await requirePermission("legal:view");
  const [items, giudizialeStragiudKpi] = await Promise.all([
    listPraticheGiudiziali(user),
    loadHomeGiudizialeStragiudKpi(user),
  ]);
  const inValutazione = items.filter(
    (i) => i.statoAvvio === "IN_ATTESA_VALUTAZIONE_LEGALE"
  ).length;
  const inStrategia = items.filter(
    (i) =>
      i.statoAvvio === "GIUDIZIALE_AVVIATO_PROCEDURA_DA_DEFINIRE" ||
      i.statoAvvio === "IN_PROCEDURA" ||
      i.statoAvvio === "CONCLUSA_CON_ESITO" ||
      i.statoAvvio === "PROCEDURA_AVVIATA"
  ).length;

  // Sulla panoramica Legal il KPI giudiziale apre l'elenco pratiche filtrato
  // (Valutazione/Strategia sotto restano le sezioni operative).
  const kpiCards = {
    ...giudizialeStragiudKpi,
    attivitaGiudizialeHref: `/pratiche?${ATTIVITA_GIUDIZIALE_PARAM}=1`,
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Gestione legale"
        subtitle="L'avvio giudiziale parte dalla pratica. Da qui: Valutazione e Strategia."
      />
      <LegalPhaseNav attivo="panoramica" />

      <div>
        <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
          Scadenze stragiudiziale e attività giudiziale
        </h2>
        <HomeGiudizialeStragiudCards kpi={kpiCards} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card title="Valutazione">
          <p className="text-sm text-[var(--muted)]">
            Pratiche in attesa di valutazione legale.
          </p>
          <p className="mt-2 text-2xl font-bold tabular-nums text-[var(--navy)]">
            {inValutazione}
          </p>
          <Link
            href="/legal/valutazione"
            className="mt-3 inline-flex h-9 items-center rounded-lg bg-[var(--navy)] px-3 text-sm font-semibold text-white hover:opacity-90"
          >
            Elenco valutazione
          </Link>
        </Card>
        <Card title="Strategia">
          <p className="text-sm text-[var(--muted)]">
            Strategia / procedura e pratiche concluse.
          </p>
          <p className="mt-2 text-2xl font-bold tabular-nums text-[var(--navy)]">
            {inStrategia}
          </p>
          <Link
            href="/legal/strategia"
            className="mt-3 inline-flex h-9 items-center rounded-lg bg-[var(--navy)] px-3 text-sm font-semibold text-white hover:opacity-90"
          >
            Elenco strategia
          </Link>
        </Card>
      </div>

      <Card title="Navigazione">
        <p className="text-sm text-[var(--navy)]">
          Per avviare la fase giudiziale usa il pulsante{" "}
          <strong>Avvia giudiziale</strong> sulla scheda pratica. Da Menu → Legal
          gestisci valutazione e strategia sugli elenchi.
        </p>
      </Card>
    </div>
  );
}
