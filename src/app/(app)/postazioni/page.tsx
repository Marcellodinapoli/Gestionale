import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/guard";
import { Card, PageHeader } from "@/components/ui";
import { creaPostazioneAction } from "@/actions/postazione";
import { PostazioniTable } from "@/components/postazioni/PostazioniTable";

export default async function PostazioniPage() {
  const user = await requirePermission("operatori:manage");

  const postazioni = await prisma.postazione.findMany({
    where: { tenantId: user.tenantId },
    orderBy: { nome: "asc" },
    include: {
      occupanti: {
        where: { active: true, tenantId: user.tenantId },
        select: { id: true, name: true },
      },
    },
  });

  const lista = postazioni.map((p) => ({
    id: p.id,
    nome: p.nome,
    interno: p.interno,
    email: p.email,
    numeroFisso: p.numeroFisso,
    sede: p.sede,
    note: p.note,
    active: p.active,
    occupanti: p.occupanti.map((o) => o.name),
  }));

  const inputCls =
    "mt-1 h-9 w-full rounded-lg border border-[var(--line)] px-3 text-sm";

  return (
    <div className="space-y-4">
      <PageHeader
        title="Postazioni"
        subtitle="Crea e gestisci le postazioni disponibili al login degli operatori"
      />

      <Card title="Nuova postazione">
        <form
          action={creaPostazioneAction}
          className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3"
        >
          <label>
            <span className="text-[10px] font-semibold uppercase text-[var(--muted)]">
              Nome / Codice *
            </span>
            <input name="nome" required className={inputCls} placeholder="es. PC-01" />
          </label>
          <label>
            <span className="text-[10px] font-semibold uppercase text-[var(--muted)]">
              Interno
            </span>
            <input name="interno" className={inputCls} placeholder="es. 201" />
          </label>
          <label>
            <span className="text-[10px] font-semibold uppercase text-[var(--muted)]">
              Email postazione
            </span>
            <input name="email" type="email" className={inputCls} placeholder="pc01@azienda.it" />
          </label>
          <label>
            <span className="text-[10px] font-semibold uppercase text-[var(--muted)]">
              Numero fisso
            </span>
            <input name="numeroFisso" className={inputCls} placeholder="es. 06 1234567" />
          </label>
          <label>
            <span className="text-[10px] font-semibold uppercase text-[var(--muted)]">
              Sede
            </span>
            <input name="sede" className={inputCls} placeholder="es. Piano 1" />
          </label>
          <label>
            <span className="text-[10px] font-semibold uppercase text-[var(--muted)]">
              Note
            </span>
            <input name="note" className={inputCls} />
          </label>
          <div className="flex items-end sm:col-span-2 lg:col-span-3">
            <button className="h-9 rounded-lg bg-[var(--navy)] px-4 text-sm font-medium text-white hover:opacity-90">
              Crea postazione
            </button>
          </div>
        </form>
      </Card>

      <Card>
        <PostazioniTable postazioni={lista} />
      </Card>
    </div>
  );
}
