import { requirePermission } from "@/lib/guard";
import { PageHeader } from "@/components/ui";
import { LegalPhaseNav } from "@/components/giudiziale/LegalPhaseNav";
import { GiudizialeElencoTable } from "@/components/giudiziale/GiudizialeElencoTable";
import {
  listPraticheGiudiziali,
  toLegalElencoRow,
} from "@/lib/giudiziale/praticaGiudizialeRepo";

export default async function LegalStrategiaPage() {
  const user = await requirePermission("legal:view");
  const items = (
    await listPraticheGiudiziali(user, {
      stati: [
        "GIUDIZIALE_AVVIATO_PROCEDURA_DA_DEFINIRE",
        "IN_PROCEDURA",
        "CONCLUSA_CON_ESITO",
        "PROCEDURA_AVVIATA",
      ],
    })
  ).map(toLegalElencoRow);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Strategia"
        subtitle="Stesso percorso della pratica: apri strategia / procedura sul fascicolo."
      />
      <LegalPhaseNav attivo="strategia" />
      <GiudizialeElencoTable
        items={items}
        emptyMessage="Nessuna pratica in strategia. Completa la valutazione legale e definisci la strategia."
        primaryHref={(id) => `/pratiche/${id}/strategia-giudiziale`}
        primaryLabel="Apri strategia"
      />
    </div>
  );
}
