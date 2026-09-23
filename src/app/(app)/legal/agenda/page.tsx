import { requireNavPage } from "@/lib/guard";
import { PageHeader } from "@/components/ui";
import { AgendaCalendarioPanel } from "@/components/agenda/AgendaCalendarioPanel";
import {
  loadAgendaLegale,
  toCalendarioLegaleVoci,
} from "@/lib/agenda/loadAgendaLegale";

export default async function LegalAgendaPage({
  searchParams,
}: {
  searchParams: Promise<{
    vista?: string;
    data?: string;
    pratica?: string;
  }>;
}) {
  const user = await requireNavPage("legal");
  const sp = await searchParams;
  const praticaId = sp.pratica?.trim() || undefined;
  const voci = toCalendarioLegaleVoci(
    await loadAgendaLegale(user, { praticaId })
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Agenda legale"
        subtitle={
          praticaId
            ? "Impegni con data di questa pratica: avvio, scadenze strategia, esito."
            : "Impegni con data dalle pagine Legal: affidamento, attività, udienze, esito."
        }
      />
      <AgendaCalendarioPanel
        voci={voci}
        vistaRaw={sp.vista}
        dataRaw={sp.data}
        basePath="/legal/agenda"
        soloLegale
        queryExtras={praticaId ? { pratica: praticaId } : undefined}
      />
    </div>
  );
}
