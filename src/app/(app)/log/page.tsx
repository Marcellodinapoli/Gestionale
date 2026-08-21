import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/guard";
import { dataOraIt, nessunDatoWhere } from "@/lib/domain";
import { Card, PageHeader } from "@/components/ui";
import { isManutenzione } from "@/lib/permissions";

export default async function LogPage() {
  const user = await requirePermission("audit:view");
  const logs = await prisma.auditLog.findMany({
    where: isManutenzione(user) ? nessunDatoWhere() : undefined,
    include: { user: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div>
      <PageHeader title="Log" subtitle="Tracciatura operazioni" />
      <Card>
        <table className="w-full text-sm">
          <thead className="text-left text-[var(--muted)]">
            <tr>
              <th className="py-2">Quando</th>
              <th>Utente</th>
              <th>Azione</th>
              <th>Entità</th>
              <th>Dettaglio</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id} className="border-t border-[var(--line)]">
                <td className="py-2 whitespace-nowrap">{dataOraIt(l.createdAt)}</td>
                <td>{l.user?.name || "—"}</td>
                <td>{l.action}</td>
                <td>
                  {l.entity} {l.entityId ? `· ${l.entityId.slice(0, 8)}` : ""}
                </td>
                <td className="max-w-xs truncate">{l.dettaglio}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
