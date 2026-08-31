import { requirePermission } from "@/lib/guard";
import { PageHeader } from "@/components/ui";
import { AgendaMessaggiPanel } from "@/components/agenda/AgendaMessaggiPanel";
import { buildAgendaScopeContext } from "@/lib/agenda/buildAgendaScope";
import { loadMessaggiAgendaScopedAuto } from "@/lib/agenda/loadAgenda";
import { messaggiInterniFromUser } from "@/lib/messaggiInterniRepo";

export default async function MessaggiPage({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: string }>;
}) {
  const user = await requirePermission("agenda:view");
  const sp = await searchParams;
  const ctx = await buildAgendaScopeContext(user);

  const [messaggiPraticaRaw, intern] = await Promise.all([
    loadMessaggiAgendaScopedAuto(ctx, user),
    messaggiInterniFromUser(user).list(ctx.tenantSlug, ctx.tenantId, {
      userId: user.id,
      take: 100,
    }),
  ]);

  const messaggiPratica = messaggiPraticaRaw.map((m) => {
    const row = m as {
      id: string;
      praticaId: string;
      line: string;
      letto: boolean;
      lettoAt?: string | null;
      createdAt: string;
      pratica?: {
        numero: string;
        debitore?: { nome: string; cognome: string };
      };
      user?: { name: string };
    };
    return {
      id: row.id,
      praticaId: row.praticaId,
      praticaNumero: row.pratica?.numero ?? "",
      debitore: row.pratica?.debitore
        ? `${row.pratica.debitore.cognome} ${row.pratica.debitore.nome}`
        : "",
      line: row.line,
      autore: row.user?.name ?? "",
      createdAt: row.createdAt,
      letto: row.letto,
      lettoAt: row.lettoAt ?? null,
    };
  });

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
          fromName: m.fromUser?.name ?? "",
          toName: m.toUser?.name ?? "",
          testo: m.testo,
          createdAt: m.createdAt,
          letto: m.letto,
          lettoAt: m.lettoAt,
          praticaId: m.praticaId,
          praticaNumero: m.pratica?.numero ?? null,
          debitore: m.pratica?.debitore
            ? `${m.pratica.debitore.cognome} ${m.pratica.debitore.nome}`
            : null,
        }))}
        messaggiPratica={messaggiPratica}
      />
    </div>
  );
}
