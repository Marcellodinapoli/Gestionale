import { notFound } from "next/navigation";
import { requireNavPage } from "@/lib/guard";
import { canAccessPratica } from "@/lib/domain";
import { praticaDbFromUser } from "@/lib/praticheRepo";
import { getPraticaGiudizialeByPraticaId } from "@/lib/giudiziale/praticaGiudizialeRepo";
import { GiudizialeNavTabs } from "@/components/giudiziale/GiudizialeNavTabs";
import { PageHeader } from "@/components/ui";
import { PraticaContabileShell } from "@/components/pratica/PraticaContabileShell";
import { AgendaCalendarioPanel } from "@/components/agenda/AgendaCalendarioPanel";
import { expandImpegniLegali } from "@/lib/agenda/scadenzeGiudiziali";
import { toCalendarioLegaleVoci } from "@/lib/agenda/loadAgendaLegale";

export default async function AgendaLegalePraticaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ vista?: string; data?: string }>;
}) {
  const user = await requireNavPage("legal");
  const { id } = await params;
  if (!(await canAccessPratica(user, id))) notFound();

  const [pratica, giudiziale, sp] = await Promise.all([
    praticaDbFromUser(user).findUnique({
      where: { id },
      include: {
        debitore: { select: { nome: true, cognome: true } },
      },
    }),
    getPraticaGiudizialeByPraticaId(user, id),
    searchParams,
  ]);
  if (!pratica) notFound();

  const debitoreNome =
    `${pratica.debitore.cognome} ${pratica.debitore.nome}`.trim() || "—";
  const voci = toCalendarioLegaleVoci(
    expandImpegniLegali({
      praticaId: pratica.id,
      numero: pratica.numero,
      debitore: pratica.debitore,
      dataAffidamentoGiudiziale: giudiziale?.dataAffidamentoGiudiziale,
      attivitaProceduraJson: giudiziale?.attivitaProceduraJson,
      agendaScadenze: giudiziale?.agendaScadenze,
      dataEsito: giudiziale?.dataEsito,
    })
  );

  return (
    <div className="h-full min-h-0">
      <PraticaContabileShell
        praticaId={pratica.id}
        numero={pratica.numero}
        debitore={debitoreNome}
      >
        <div className="space-y-4">
          <GiudizialeNavTabs praticaId={pratica.id} attivo="agenda" />
          <PageHeader
            title="Agenda legale"
            subtitle={`Pratica ${pratica.numero} · ${debitoreNome} · Date di avvio, strategia ed esito`}
          />
          <AgendaCalendarioPanel
            voci={voci}
            vistaRaw={sp.vista}
            dataRaw={sp.data}
            basePath={`/pratiche/${pratica.id}/agenda-legale`}
            soloLegale
          />
        </div>
      </PraticaContabileShell>
    </div>
  );
}
