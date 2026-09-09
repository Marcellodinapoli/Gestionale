import { requirePermission } from "@/lib/guard";
import { PageHeader } from "@/components/ui";
import { LegalPhaseNav } from "@/components/giudiziale/LegalPhaseNav";
import { GiudizialeElencoTable } from "@/components/giudiziale/GiudizialeElencoTable";
import {
  listPraticheGiudiziali,
  toLegalElencoRow,
} from "@/lib/giudiziale/praticaGiudizialeRepo";

export default async function LegalValutazionePage() {
  const user = await requirePermission("legal:view");
  const items = (
    await listPraticheGiudiziali(user, {
      stati: ["IN_ATTESA_VALUTAZIONE_LEGALE"],
    })
  ).map(toLegalElencoRow);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Valutazione"
        subtitle="Elenco pratiche in attesa di valutazione legale — stesso percorso della pratica."
      />
      <LegalPhaseNav attivo="valutazione" />
      <GiudizialeElencoTable
        items={items}
        emptyMessage="Nessuna pratica in attesa di valutazione legale. Usa «Avvia giudiziale» sulla pratica e conferma «Richiedi valutazione legale»."
        primaryHref={(id) => `/pratiche/${id}/valutazione-legale`}
        primaryLabel="Apri valutazione"
      />
    </div>
  );
}
