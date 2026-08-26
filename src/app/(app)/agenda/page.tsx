import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/guard";
import { praticaScopeWhere } from "@/lib/gruppoPerimetroScope";
import { PageHeader } from "@/components/ui";
import { AgendaCalendarioPanel } from "@/components/agenda/AgendaCalendarioPanel";

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

  const baseScope = await praticaScopeWhere(user);

  const [items, impegni] = await Promise.all([
    prisma.pratica.findMany({
      where: {
        AND: [baseScope, { memoAt: { not: null } }],
      },
      include: {
        debitore: { select: { nome: true, cognome: true } },
        assegnatario: { select: { name: true } },
      },
      orderBy: { memoAt: "asc" },
      take: 200,
    }),
    prisma.impegnoAgenda.findMany({
      where: { userId: user.id, completato: false },
      include: { user: { select: { name: true } } },
      orderBy: { memoAt: "asc" },
      take: 200,
    }),
  ]);

  const calendario = [
    ...items.map((p) => ({
      kind: "pratica" as const,
      id: p.id,
      memoAt: p.memoAt!.toISOString(),
      numero: p.numero,
      debitore: p.debitore
        ? `${p.debitore.nome} ${p.debitore.cognome}`
        : "—",
      tipoContatto: p.tipoContatto,
      esitoContatto: p.esitoContatto,
      assegnatario: p.assegnatario?.name || null,
    })),
    ...impegni.map((i) => ({
      kind: "libero" as const,
      id: i.id,
      memoAt: i.memoAt.toISOString(),
      titolo: i.titolo,
      nota: i.nota,
      autore: i.user?.name || "—",
    })),
  ].sort((a, b) => new Date(a.memoAt).getTime() - new Date(b.memoAt).getTime());

  return (
    <div>
      <PageHeader
        title="Agenda"
        subtitle="Impegni e richiami · vista giornaliera, settimanale o mensile"
      />
      <AgendaCalendarioPanel voci={calendario} vistaRaw={sp.vista} dataRaw={sp.data} />
    </div>
  );
}
