import { requirePermission } from "@/lib/guard";
import { PageHeader } from "@/components/ui";
import { LegalPhaseNav } from "@/components/giudiziale/LegalPhaseNav";
import { GiudizialeElencoTable } from "@/components/giudiziale/GiudizialeElencoTable";
import {
  listPraticheGiudiziali,
  toLegalElencoRow,
} from "@/lib/giudiziale/praticaGiudizialeRepo";

export default async function LegalAvvioPage() {
  const user = await requirePermission("legal:view");
  const items = (
    await listPraticheGiudiziali(user, {
      stati: ["BOZZA", "ARCHIVIATA_SENZA_AZIONE", "IN_ATTESA_VALUTAZIONE_LEGALE"],
    })
  ).map(toLegalElencoRow);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Avvio"
        subtitle="Pratiche già entrate nel flusso Legal, nella fase di avvio."
      />
      <LegalPhaseNav attivo="avvio" />
      <GiudizialeElencoTable
        items={items}
        emptyMessage="Nessuna pratica in avvio. Dalla pratica usa «Avvia giudiziale» per farla entrare nel flusso Legal."
        primaryHref={(id) => `/pratiche/${id}/avvio-giudiziale`}
        primaryLabel="Apri avvio"
      />
    </div>
  );
}
