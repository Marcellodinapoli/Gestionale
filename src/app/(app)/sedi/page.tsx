import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/guard";
import { canManageSedi } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { Card, PageHeader } from "@/components/ui";
import { creaSedeAction } from "@/actions/sedi";
import { SediTable } from "@/components/sedi/SediTable";

export default async function SediPage() {
  const user = await requireUser();
  if (!canManageSedi(user)) redirect("/");

  const sedi = await prisma.sede.findMany({
    where: { tenantId: user.tenantId },
    orderBy: { nome: "asc" },
    include: {
      _count: { select: { postazioni: true, users: true } },
    },
  });

  const lista = sedi.map((s) => ({
    id: s.id,
    nome: s.nome,
    active: s.active,
    nPostazioni: s._count.postazioni,
    nUtenti: s._count.users,
  }));

  const inputCls =
    "mt-1 h-9 w-full rounded-lg border border-[var(--line)] px-3 text-sm";

  return (
    <div className="space-y-4">
      <PageHeader
        title="Sedi"
        subtitle="Gestisci le sedi dell’azienda. Postazioni e operatori si collegano a una sede."
      />

      <Card title="Nuova sede">
        <form action={creaSedeAction} className="flex flex-wrap items-end gap-3 text-sm">
          <label className="min-w-[200px] flex-1">
            <span className="text-[10px] font-semibold uppercase text-[var(--muted)]">
              Nome sede *
            </span>
            <input
              name="nome"
              required
              className={inputCls}
              placeholder="es. Roma, Milano, Napoli"
            />
          </label>
          <button className="h-9 rounded-lg bg-[var(--navy)] px-4 text-sm font-medium text-white hover:opacity-90">
            Crea sede
          </button>
        </form>
      </Card>

      <Card>
        <SediTable sedi={lista} />
      </Card>
    </div>
  );
}
