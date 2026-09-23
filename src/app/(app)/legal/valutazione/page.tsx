import { requireNavPage } from "@/lib/guard";
import { PageHeader } from "@/components/ui";
import { GiudizialeElencoTable } from "@/components/giudiziale/GiudizialeElencoTable";
import {
  listPraticheGiudiziali,
  toLegalElencoRow,
} from "@/lib/giudiziale/praticaGiudizialeRepo";
import { LegalAgendaUpcoming } from "@/components/giudiziale/LegalAgendaUpcoming";
import { loadAgendaLegale } from "@/lib/agenda/loadAgendaLegale";

export default async function LegalValutazionePage() {
  const user = await requireNavPage("legal");
  const [elenco, impegniLegali] = await Promise.all([
    listPraticheGiudiziali(user, {
      stati: ["IN_ATTESA_VALUTAZIONE_LEGALE"],
    }),
    loadAgendaLegale(user),
  ]);
  const items = elenco.map(toLegalElencoRow);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Valutazione"
        subtitle="Elenco pratiche in attesa di valutazione legale — stesso percorso della pratica."
      />
      <LegalAgendaUpcoming
        voci={impegniLegali}
        title="Impegni con data"
      />
      <GiudizialeElencoTable
        items={items}
        emptyMessage="Nessuna pratica in attesa di valutazione legale. Usa «Avvia giudiziale» sulla pratica e conferma «Richiedi valutazione legale»."
        primaryHref={(id) => `/pratiche/${id}/valutazione-legale`}
        primaryLabel="Apri valutazione"
      />
    </div>
  );
}
