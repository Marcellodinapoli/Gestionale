import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/guard";
import { praticaWhere } from "@/lib/domain";
import { PageHeader } from "@/components/ui";
import { AgendaCalendarioPanel } from "@/components/agenda/AgendaCalendarioPanel";
import { AgendaMessaggiPanel } from "@/components/agenda/AgendaMessaggiPanel";

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
  const messaggi = sp.tab === "messaggi";
  const tabKey = messaggi ? "messaggi" : "calendario";

  const [items, impegni, messaggiPratica, intern] = await Promise.all([
    prisma.pratica.findMany({
      where: {
        ...praticaWhere(user),
        memoAt: { not: null },
      },
      include: { debitore: true, assegnatario: true },
      orderBy: { memoAt: "asc" },
      take: 500,
    }),
    prisma.impegnoAgenda.findMany({
      where: { userId: user.id, completato: false },
      include: { user: { select: { name: true } } },
      orderBy: { memoAt: "asc" },
      take: 500,
    }),
    prisma.messaggioAgenda.findMany({
      where: {
        pratica: praticaWhere(user),
      },
      include: {
        pratica: { include: { debitore: true } },
        user: true,
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.messaggioInterno.findMany({
      where: {
        OR: [{ toUserId: user.id }, { fromUserId: user.id }],
      },
      include: {
        fromUser: true,
        toUser: true,
        pratica: { include: { debitore: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  ]);

  const calendario = [
    ...items.map((p) => ({
      kind: "pratica" as const,
      id: p.id,
      memoAt: p.memoAt!.toISOString(),
      numero: p.numero,
      debitore: `${p.debitore.nome} ${p.debitore.cognome}`,
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
      autore: i.user.name,
    })),
  ].sort((a, b) => new Date(a.memoAt).getTime() - new Date(b.memoAt).getTime());

  const daLeggere =
    intern.filter((m) => m.toUserId === user.id && !m.letto).length +
    messaggiPratica.filter((m) => !m.letto).length;

  return (
    <div>
      <PageHeader
        title="Agenda / Messaggi"
        subtitle={
          tabKey === "calendario"
            ? "Impegni e richiami · vista giornaliera, settimanale o mensile"
            : "Messaggi ricevuti e inviati · da leggere e già letti"
        }
      />

      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        <Link
          href="/agenda"
          className={`rounded-lg px-3 py-1.5 ${
            tabKey === "calendario" ? "bg-[#132033] text-white" : "border border-[var(--line)] bg-white"
          }`}
        >
          Calendario ({calendario.length})
        </Link>
        <Link
          href="/agenda?tab=messaggi"
          className={`rounded-lg px-3 py-1.5 ${
            tabKey === "messaggi" ? "bg-[#132033] text-white" : "border border-[var(--line)] bg-white"
          }`}
        >
          Messaggi
          {daLeggere ? (
            <span className="ml-1.5 rounded-full bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold text-amber-950">
              {daLeggere}
            </span>
          ) : null}
        </Link>
      </div>

      {tabKey === "calendario" ? (
        <AgendaCalendarioPanel voci={calendario} vistaRaw={sp.vista} dataRaw={sp.data} />
      ) : (
        <AgendaMessaggiPanel
          userId={user.id}
          filtroRaw={sp.filtro}
          interni={intern.map((m) => ({
            id: m.id,
            fromUserId: m.fromUserId,
            toUserId: m.toUserId,
            fromName: m.fromUser.name,
            toName: m.toUser.name,
            testo: m.testo,
            createdAt: m.createdAt.toISOString(),
            letto: m.letto,
            lettoAt: m.lettoAt?.toISOString() ?? null,
            praticaId: m.praticaId,
            praticaNumero: m.pratica?.numero ?? null,
            debitore: m.pratica
              ? `${m.pratica.debitore.cognome} ${m.pratica.debitore.nome}`
              : null,
          }))}
          messaggiPratica={messaggiPratica.map((m) => ({
            id: m.id,
            praticaId: m.praticaId,
            praticaNumero: m.pratica.numero,
            debitore: `${m.pratica.debitore.cognome} ${m.pratica.debitore.nome}`,
            line: m.line,
            autore: m.user.name,
            createdAt: m.createdAt.toISOString(),
            letto: m.letto,
            lettoAt: m.lettoAt?.toISOString() ?? null,
          }))}
        />
      )}
    </div>
  );
}
