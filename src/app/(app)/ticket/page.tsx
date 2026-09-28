import { requireNavPage } from "@/lib/guard";
import { PageHeader } from "@/components/ui";
import { TicketPageClient } from "@/components/support/TicketPageClient";
import {
  listMessagesForTicket,
  listTicketsForTenant,
} from "@/lib/support/credixaSupport";
import { redirect } from "next/navigation";

export default async function TicketPage() {
  const user = await requireNavPage("ticket");
  if (user.role !== "ADMIN") redirect("/account");

  let tickets: Awaited<ReturnType<typeof listTicketsForTenant>> = [];
  let loadError: string | null = null;
  try {
    tickets = await listTicketsForTenant(user.tenantId);
  } catch (err) {
    loadError =
      err instanceof Error
        ? err.message
        : "Impossibile caricare i ticket (verifica Firebase Admin)";
  }

  const messagesByTicket: Record<
    string,
    Awaited<ReturnType<typeof listMessagesForTicket>>
  > = {};
  if (!loadError) {
    await Promise.all(
      tickets.map(async (t) => {
        try {
          messagesByTicket[t.id] = await listMessagesForTicket(t.id);
        } catch {
          messagesByTicket[t.id] = [];
        }
      })
    );
  }

  return (
    <div>
      <PageHeader
        title="Ticket assistenza"
        subtitle="Apri e segui le richieste di supporto Credixa"
      />
      {loadError ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {loadError}
        </p>
      ) : (
        <TicketPageClient tickets={tickets} messagesByTicket={messagesByTicket} />
      )}
    </div>
  );
}
