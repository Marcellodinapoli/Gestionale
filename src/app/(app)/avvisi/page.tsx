import { requireNavPage } from "@/lib/guard";
import { PageHeader, Card } from "@/components/ui";
import {
  listAnnouncementsForTenant,
  listReadAnnouncementIds,
  markAnnouncementsReadMany,
} from "@/lib/avvisi/credixaAnnouncements";
import { redirect } from "next/navigation";

function formatQuando(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("it-IT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function typeLabel(type: string) {
  switch (type) {
    case "alert":
      return "Alert";
    case "aggiornamento":
      return "Aggiornamento";
    default:
      return "Avviso";
  }
}

export default async function AvvisiPage() {
  const user = await requireNavPage("avvisi");
  if (user.role !== "ADMIN") redirect("/account");

  let items: Awaited<ReturnType<typeof listAnnouncementsForTenant>> = [];
  let readIds = new Set<string>();
  let loadError: string | null = null;
  try {
    [items, readIds] = await Promise.all([
      listAnnouncementsForTenant(user.tenantId),
      listReadAnnouncementIds(user.tenantId, user.id),
    ]);

    // Apertura pagina = letti: badge nav e stato aggiornati.
    const unreadIds = items.filter((a) => !readIds.has(a.id)).map((a) => a.id);
    if (unreadIds.length > 0) {
      await markAnnouncementsReadMany({
        announcementIds: unreadIds,
        tenantId: user.tenantId,
        userId: user.id,
      });
      for (const id of unreadIds) readIds.add(id);
    }
  } catch (err) {
    loadError =
      err instanceof Error ? err.message : "Impossibile caricare gli avvisi";
  }

  return (
    <div>
      <PageHeader
        title="Avvisi"
        subtitle="Comunicazioni dal Back Office Credixa"
      />
      {loadError ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {loadError}
        </p>
      ) : items.length === 0 ? (
        <Card>
          <p className="py-6 text-center text-sm text-[var(--muted)]">
            Nessun avviso al momento
          </p>
        </Card>
      ) : (
        <ul className="space-y-3">
          {items.map((a) => {
            const letto = readIds.has(a.id);
            return (
              <li key={a.id}>
                <Card>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                        {typeLabel(a.type)}
                        {a.target === "tenant"
                          ? " · solo la tua azienda"
                          : " · tutte le aziende"}
                      </p>
                      <h3 className="mt-0.5 text-base font-semibold text-[var(--navy)]">
                        {a.title}
                      </h3>
                      <p className="text-xs text-[var(--muted)]">
                        {formatQuando(a.createdAt)}
                      </p>
                    </div>
                    <span
                      className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                        letto
                          ? "bg-slate-100 text-slate-600"
                          : "bg-amber-100 text-amber-900"
                      }`}
                    >
                      {letto ? "Letto" : "Nuovo"}
                    </span>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm text-[var(--navy)]">
                    {a.message}
                  </p>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
