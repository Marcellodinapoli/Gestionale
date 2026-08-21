import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/guard";
import { dataIt, euro } from "@/lib/domain";
import {
  PROVVIGIONE_PERCENTUALE,
  provvigioneStatoLabel,
  provvigioniWhere,
} from "@/lib/provvigioni";
import { Card, PageHeader } from "@/components/ui";
import { ProvvigioniTableAdmin } from "@/components/provvigioni/ProvvigioniTableAdmin";

function inizioMese(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

function fineMese(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

export default async function ProvigioniPage({
  searchParams,
}: {
  searchParams: Promise<{ mese?: string; mandante?: string; gruppo?: string; operatore?: string }>;
}) {
  const user = await requirePermission("provigioni:view");
  const { mese: meseRaw, mandante: mandanteId, gruppo: gruppoId, operatore: operatoreId } = await searchParams;

  const ref = meseRaw ? new Date(`${meseRaw}-01T12:00:00`) : new Date();
  const da = inizioMese(ref);
  const a = fineMese(ref);
  const meseValue = `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, "0")}`;

  const canFilter = ["ADMIN", "AMMINISTRAZIONE"].includes(user.role);

  const [mandanti, supervisori, operatori] = canFilter
    ? await Promise.all([
        prisma.mandante.findMany({ where: { tenantId: user.tenantId }, orderBy: { ragioneSociale: "asc" }, select: { id: true, codice: true, ragioneSociale: true } }),
        prisma.user.findMany({ where: { tenantId: user.tenantId, role: "SUPERVISOR" }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
        prisma.user.findMany({ where: { tenantId: user.tenantId, role: { in: ["OPERATOR", "SUPERVISOR"] }, active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
      ])
    : [[], [], []];

  const scope = provvigioniWhere(user);
  const wherePeriodo: Record<string, unknown> = {
    ...scope,
    createdAt: { gte: da, lte: a },
    ...(mandanteId ? { pratica: { mandanteId } } : {}),
    ...(operatoreId ? { operatoreId } : gruppoId ? { operatore: { OR: [{ id: gruppoId }, { supervisorId: gruppoId }] } } : {}),
  };

  const [righe, totali, maturate, liquidate] = await Promise.all([
    prisma.provvigione.findMany({
      where: wherePeriodo,
      include: {
        operatore: { select: { name: true } },
        pratica: {
          include: {
            debitore: { select: { nome: true, cognome: true } },
          },
        },
        incasso: { select: { data: true, importo: true, metodo: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.provvigione.aggregate({
      where: wherePeriodo,
      _sum: { importo: true },
      _count: true,
    }),
    prisma.provvigione.aggregate({
      where: { ...wherePeriodo, stato: "MATURATA" },
      _sum: { importo: true },
    }),
    prisma.provvigione.aggregate({
      where: { ...wherePeriodo, stato: "LIQUIDATA" },
      _sum: { importo: true },
    }),
  ]);

  const subtitle =
    user.role === "OPERATOR"
      ? `Le tue provvigioni · ${PROVVIGIONE_PERCENTUALE}% sull'incasso`
      : user.role === "SUPERVISOR"
        ? `Team · ${PROVVIGIONE_PERCENTUALE}% sull'incasso`
        : `Tutte le provvigioni · filtra per mandante e gruppo`;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader title="Provigioni" subtitle={subtitle} />

      <form className="mb-3 flex shrink-0 flex-wrap items-end gap-2">
        <label className="text-sm">
          <span className="mb-1 block text-xs font-medium text-[var(--muted)]">Mese</span>
          <input
            type="month"
            name="mese"
            defaultValue={meseValue}
            className="h-10 rounded-lg border border-[var(--line)] px-3 text-sm"
          />
        </label>
        {canFilter && (
          <>
            <label className="text-sm">
              <span className="mb-1 block text-xs font-medium text-[var(--muted)]">Mandante</span>
              <select
                name="mandante"
                defaultValue={mandanteId || ""}
                className="h-10 min-w-[180px] rounded-lg border border-[var(--line)] px-3 text-sm"
              >
                <option value="">Tutte</option>
                {mandanti.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.codice} · {m.ragioneSociale}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-xs font-medium text-[var(--muted)]">Operatore</span>
              <select
                name="operatore"
                defaultValue={operatoreId || ""}
                className="h-10 min-w-[160px] rounded-lg border border-[var(--line)] px-3 text-sm"
              >
                <option value="">Tutti</option>
                {operatori.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-xs font-medium text-[var(--muted)]">Gruppo</span>
              <select
                name="gruppo"
                defaultValue={gruppoId || ""}
                className="h-10 min-w-[160px] rounded-lg border border-[var(--line)] px-3 text-sm"
              >
                <option value="">Tutti</option>
                {supervisori.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
        <button className="h-10 rounded-lg border border-[var(--line)] bg-white px-4 text-sm">
          Filtra
        </button>
      </form>

      <div className="mb-3 grid shrink-0 gap-3 sm:grid-cols-3">
        <Card title="Totale mese">
          <p className="text-2xl font-semibold">{euro(totali._sum.importo || 0)}</p>
          <p className="mt-1 text-xs text-[var(--muted)]">{totali._count} movimenti</p>
        </Card>
        <Card title="Maturate">
          <p className="text-2xl font-semibold text-[var(--accent)]">
            {euro(maturate._sum.importo || 0)}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">Da liquidare</p>
        </Card>
        <Card title="Liquidate">
          <p className="text-2xl font-semibold">{euro(liquidate._sum.importo || 0)}</p>
          <p className="mt-1 text-xs text-[var(--muted)]">Già erogate</p>
        </Card>
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-[var(--line)] bg-white p-3">
        {canFilter ? (
          <ProvvigioniTableAdmin
            righe={righe.map((r) => ({
              id: r.id,
              praticaId: r.praticaId,
              praticaNumero: r.pratica.numero,
              debitoreNome: `${r.pratica.debitore.nome} ${r.pratica.debitore.cognome}`,
              operatoreNome: r.operatore.name,
              data: dataIt(r.incasso.data),
              baseImporto: r.baseImporto,
              percentuale: r.percentuale,
              importo: r.importo,
              stato: r.stato,
              statoLabel: provvigioneStatoLabel(r.stato),
            }))}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-[var(--muted)]">
                <tr>
                  <th className="px-3 py-2">Data</th>
                  {user.role !== "OPERATOR" ? <th>Operatore</th> : null}
                  <th>Pratica</th>
                  <th>Debitore</th>
                  <th>Incasso</th>
                  <th>%</th>
                  <th>Provvigione</th>
                  <th>Stato</th>
                </tr>
              </thead>
              <tbody>
                {righe.map((r) => (
                  <tr key={r.id} className="border-t border-[var(--line)]">
                    <td className="px-3 py-2">{dataIt(r.incasso.data)}</td>
                    {user.role !== "OPERATOR" ? <td>{r.operatore.name}</td> : null}
                    <td>
                      <Link
                        className="text-[var(--accent)] underline"
                        href={`/pratiche/${r.praticaId}`}
                      >
                        {r.pratica.numero}
                      </Link>
                    </td>
                    <td>
                      {r.pratica.debitore.nome} {r.pratica.debitore.cognome}
                    </td>
                    <td>{euro(r.baseImporto)}</td>
                    <td>{r.percentuale.toFixed(1)}%</td>
                    <td className="font-semibold">{euro(r.importo)}</td>
                    <td>
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                          r.stato === "LIQUIDATA"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {provvigioneStatoLabel(r.stato)}
                      </span>
                    </td>
                  </tr>
                ))}
                {!righe.length ? (
                  <tr>
                    <td
                      colSpan={user.role !== "OPERATOR" ? 8 : 7}
                      className="px-3 py-8 text-center text-[var(--muted)]"
                    >
                      Nessuna provvigione nel mese selezionato.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
