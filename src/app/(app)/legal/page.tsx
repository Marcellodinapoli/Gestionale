import Link from "next/link";
import { requirePermission } from "@/lib/guard";
import { Card, PageHeader } from "@/components/ui";
import { LegalPhaseNav } from "@/components/giudiziale/LegalPhaseNav";
import {
  listPraticheGiudiziali,
} from "@/lib/giudiziale/praticaGiudizialeRepo";

export default async function LegalPage() {
  const user = await requirePermission("legal:view");
  const items = await listPraticheGiudiziali(user);
  const inAvvio = items.filter(
    (i) =>
      i.statoAvvio === "BOZZA" ||
      i.statoAvvio === "ARCHIVIATA_SENZA_AZIONE" ||
      i.statoAvvio === "IN_ATTESA_VALUTAZIONE_LEGALE"
  ).length;
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

  return (
    <div className="space-y-4">
      <PageHeader
        title="Gestione legale"
        subtitle="Flusso: Stragiudiziale → Avvio → Valutazione → Strategia → Esito."
      />
      <LegalPhaseNav attivo="panoramica" />

      <div className="grid gap-3 sm:grid-cols-3">
        <Card title="Avvio">
          <p className="text-sm text-[var(--muted)]">
            Pratiche gia entrate nel flusso Legal, in fase di avvio.
          </p>
          <p className="mt-2 text-2xl font-bold tabular-nums text-[var(--navy)]">
            {inAvvio}
          </p>
          <Link
            href="/legal/avvio"
            className="mt-3 inline-flex h-9 items-center rounded-lg bg-[var(--navy)] px-3 text-sm font-semibold text-white hover:opacity-90"
          >
            Elenco avvio
          </Link>
        </Card>
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
          Da Menu → Legal apri l&apos;elenco; il pulsante{" "}
          <strong>Apri avvio / valutazione / strategia</strong> porta alla stessa
          pagina della pratica.
        </p>
      </Card>
    </div>
  );
}
