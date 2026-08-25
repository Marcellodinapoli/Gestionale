import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/guard";
import { praticaScopeWhere } from "@/lib/gruppoPerimetroScope";
import { PageHeader } from "@/components/ui";
import { AgendaMessaggiPanel } from "@/components/agenda/AgendaMessaggiPanel";

export default async function MessaggiPage({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: string }>;
}) {
  const user = await requirePermission("agenda:view");
  const sp = await searchParams;
  const praticaScope = await praticaScopeWhere(user);

  const [messaggiPratica, intern] = await Promise.all([
    prisma.messaggioAgenda.findMany({
      where: {
        pratica: praticaScope,
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

  const daLeggere =
    intern.filter((m) => m.toUserId === user.id && !m.letto).length +
    messaggiPratica.filter((m) => !m.letto).length;

  return (
    <div>
      <PageHeader
        title="Messaggi"
        subtitle={
          daLeggere
            ? `${daLeggere} da leggere · ricevuti e inviati`
            : "Messaggi ricevuti e inviati · da leggere e già letti"
        }
      />
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
    </div>
  );
}
