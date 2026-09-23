import { requireNavPage } from "@/lib/guard";
import { PageHeader } from "@/components/ui";
import { GiudizialeElencoTable } from "@/components/giudiziale/GiudizialeElencoTable";
import {
  listPraticheGiudiziali,
  toLegalElencoRow,
} from "@/lib/giudiziale/praticaGiudizialeRepo";
import { LegalAgendaUpcoming } from "@/components/giudiziale/LegalAgendaUpcoming";
import { loadAgendaLegale } from "@/lib/agenda/loadAgendaLegale";

export default async function LegalStrategiaPage() {
  const user = await requireNavPage("legal");
  const [elenco, impegniLegali] = await Promise.all([
    listPraticheGiudiziali(user, {
      stati: [
        "GIUDIZIALE_AVVIATO_PROCEDURA_DA_DEFINIRE",
        "IN_PROCEDURA",
        "CONCLUSA_CON_ESITO",
        "PROCEDURA_AVVIATA",
      ],
    }),
    loadAgendaLegale(user),
  ]);
  const items = elenco.map(toLegalElencoRow);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Strategia"
        subtitle="Stesso percorso della pratica: apri strategia / procedura sul fascicolo."
      />
      <LegalAgendaUpcoming
        voci={impegniLegali}
        title="Impegni con data"
      />
      <GiudizialeElencoTable
        items={items}
        emptyMessage="Nessuna pratica in strategia. Completa la valutazione legale e definisci la strategia."
        primaryHref={(id) => `/pratiche/${id}/strategia-giudiziale`}
        primaryLabel="Apri strategia"
      />
    </div>
  );
}
