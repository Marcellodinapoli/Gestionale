import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/guard";
import { PageHeader } from "@/components/ui";
import { AgendaCalendarioPanel } from "@/components/agenda/AgendaCalendarioPanel";
import { buildAgendaScopeContext } from "@/lib/agenda/buildAgendaScope";
import { loadAgendaCalendarioAuto } from "@/lib/agenda/loadAgenda";

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    vista?: string;
    data?: string;
    filtro?: string;
  }>;
}) {
  const user = await requirePermission("agenda:view");
  const sp = await searchParams;
  if (sp.tab === "messaggi") {
    redirect(sp.filtro ? `/messaggi?filtro=${encodeURIComponent(sp.filtro)}` : "/messaggi");
  }

  const ctx = await buildAgendaScopeContext(user);
  const { pratiche, impegni, giudiziali = [] } = await loadAgendaCalendarioAuto(
    ctx,
    user,
    user.id
  );

  const calendario = [
    ...pratiche.map((p) => ({
      kind: "pratica" as const,
      id: p.id,
      memoAt: p.memoAt,
      numero: p.numero,
      debitore: p.debitore ? `${p.debitore.nome} ${p.debitore.cognome}` : "—",
      tipoContatto: p.tipoContatto ?? null,
      esitoContatto: p.esitoContatto ?? null,
      assegnatario: p.assegnatario?.name || null,
    })),
    ...impegni.map((i) => ({
      kind: "libero" as const,
      id: i.id,
      memoAt: i.memoAt,
      titolo: i.titolo,
      nota: i.nota,
      autore: i.userName || "—",
    })),
    ...giudiziali.map((g) => ({
      kind: "giudiziale" as const,
      id: g.id,
      praticaId: g.praticaId,
      memoAt: g.memoAt,
      titolo: g.titolo,
      activityLabel: g.activityLabel,
      numero: g.numero,
      debitore: `${g.debitore.nome} ${g.debitore.cognome}`.trim() || "—",
      responsabile: g.responsabile ?? null,
    })),
  ].sort((a, b) => new Date(a.memoAt).getTime() - new Date(b.memoAt).getTime());

  return (
    <div>
      <PageHeader
        title="Agenda"
        subtitle="Impegni, richiami e scadenze legali · vista giornaliera, settimanale o mensile"
      />
      <AgendaCalendarioPanel voci={calendario} vistaRaw={sp.vista} dataRaw={sp.data} />
    </div>
  );
}
