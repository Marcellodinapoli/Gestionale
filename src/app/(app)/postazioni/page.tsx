import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/guard";
import { Card, PageHeader } from "@/components/ui";
import { PostazioniTable } from "@/components/postazioni/PostazioniTable";
import { NuovaPostazioneButton } from "@/components/postazioni/NuovaPostazioneButton";

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

  return (
    <div className="space-y-4">
      <PageHeader
        title="Postazioni"
        subtitle="Crea e gestisci le postazioni disponibili al login degli operatori"
        action={<NuovaPostazioneButton sedi={sedi} />}
      />

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
