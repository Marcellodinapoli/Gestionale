import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/guard";
import { Card, PageHeader } from "@/components/ui";
import { creaPostazioneAction } from "@/actions/postazione";
import { PostazioniTable } from "@/components/postazioni/PostazioniTable";

export default async function PostazioniPage({
  searchParams,
}: {
  searchParams: Promise<{ sede?: string }>;
}) {
  const user = await requirePermission("operatori:manage");
  const sp = await searchParams;
  const sedeFiltro = String(sp.sede || "").trim() || null;

  const [postazioni, sedi] = await Promise.all([
    prisma.postazione.findMany({
      where: {
        tenantId: user.tenantId,
        ...(sedeFiltro ? { sedeId: sedeFiltro } : {}),
      },
      orderBy: [{ sedeRef: { nome: "asc" } }, { nome: "asc" }],
      include: {
        sedeRef: { select: { id: true, nome: true } },
        occupanti: {
          where: { active: true, tenantId: user.tenantId },
          select: { id: true, name: true },
        },
      },
    }),
    prisma.sede.findMany({
      where: { tenantId: user.tenantId, active: true },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true },
    }),
  ]);

  const lista = postazioni.map((p) => ({
    id: p.id,
    nome: p.nome,
    interno: p.interno,
    email: p.email,
    numeroFisso: p.numeroFisso,
    sedeId: p.sedeId,
    sedeNome: p.sedeRef?.nome || null,
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
              Sede *
            </span>
            <select name="sedeId" required className={inputCls} defaultValue="">
              <option value="" disabled>
                Seleziona sede…
              </option>
              {sedi.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nome}
                </option>
              ))}
            </select>
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
        <form className="mb-3 flex flex-wrap items-end gap-2 text-sm">
          <label>
            <span className="text-[10px] font-semibold uppercase text-[var(--muted)]">
              Filtra sede
            </span>
            <select
              name="sede"
              defaultValue={sedeFiltro || ""}
              className="mt-1 h-9 rounded-lg border border-[var(--line)] px-2 text-sm"
            >
              <option value="">Tutte</option>
              {sedi.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nome}
                </option>
              ))}
            </select>
          </label>
          <button className="h-9 rounded-lg border border-[var(--line)] px-3 text-sm hover:bg-slate-50">
            Applica
          </button>
        </form>
        <PostazioniTable postazioni={lista} sedi={sedi} />
      </Card>
    </div>
  );
}
