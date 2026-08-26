import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/guard";
import { createMandanteAction } from "@/actions/core";
import { Card, PageHeader } from "@/components/ui";
import { isManutenzione } from "@/lib/permissions";
import { nessunDatoWhere } from "@/lib/domain";
import Link from "next/link";

export default async function MandantiPage() {
  const user = await requirePermission("mandanti:manage");
  const mandanti = await prisma.mandante.findMany({
    where: isManutenzione(user) ? nessunDatoWhere() : { tenantId: user.tenantId },
    include: { _count: { select: { pratiche: true } } },
    orderBy: { codice: "asc" },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <PageHeader title="Mandanti" subtitle="Committenti / società affidatarie" />
        <Link
          href="/mandanti/nuovo"
          className="flex h-9 items-center gap-1.5 rounded-lg bg-[var(--navy)] px-4 text-sm font-medium text-white hover:opacity-90"
        >
          + Crea nuova mandante
        </Link>
      </div>
      <Card>
        <table className="w-full text-sm">
          <thead className="text-left text-[var(--muted)]">
            <tr>
              <th className="py-2">Acronimo interno</th>
              <th>Ragione sociale</th>
              <th>Pratiche</th>
            </tr>
          </thead>
          <tbody>
            {mandanti.map((m) => (
              <tr key={m.id} className="border-t border-[var(--line)] hover:bg-[#eef4f8]">
                <td className="py-2 font-medium">
                  <Link href={`/mandanti/${m.id}`} className="text-[var(--accent)] underline">
                    {m.codice}
                  </Link>
                </td>
                <td>
                  <Link href={`/mandanti/${m.id}`} className="hover:underline">
                    {m.ragioneSociale}
                  </Link>
                  <div className="text-xs text-[var(--muted)]">{m.email}</div>
                </td>
                <td>{m._count?.pratiche ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
