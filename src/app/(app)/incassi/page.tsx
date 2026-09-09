import Link from "next/link";
import { requireModule, requirePermission } from "@/lib/guard";
import { mandantiDbFromUser } from "@/lib/mandantiRepo";
import { usersDbFromUser } from "@/lib/usersRepo";
import { praticaDbFromUser } from "@/lib/praticheRepo";
import { Card, PageHeader } from "@/components/ui";
import { IncassiElencoFiltriBar } from "@/components/incassi/IncassiElencoFiltri";
import { PaginazioneBar, paginateParams } from "@/components/PaginazioneBar";
import { loadIncassiElenco } from "@/lib/incassiElenco";
import { parseIncassiElencoFiltri } from "@/lib/incassiElencoUi";
import { euro } from "@/lib/domain";

function buildIncassiQuery(
  params: Record<string, string | number | undefined>,
  page?: number
) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === "") continue;
    sp.set(k, String(v));
  }
  if (page && page > 1) sp.set("page", String(page));
  const qs = sp.toString();
  return qs ? `/incassi?${qs}` : "/incassi";
}

export default async function IncassiElencoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireModule("incassi");
  const user = await requirePermission("incassi:list");
  const sp = await searchParams;
  const filtri = parseIncassiElencoFiltri(sp);
  const { page, pageSize, skip } = paginateParams(sp.page);

  const [mandantiList, operatori, lottiRows] = await Promise.all([
    mandantiDbFromUser(user).findMany({
      select: { id: true, codice: true, ragioneSociale: true, perimetri: true },
      orderBy: { codice: "asc" },
    }),
    usersDbFromUser(user).findMany({
      where: {
        active: true,
        role: { in: ["OPERATOR", "SUPERVISOR", "BACK_OFFICE", "ADMIN", "AMMINISTRAZIONE", "LEGAL"] },
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    praticaDbFromUser(user).groupBy({
      by: ["numeroMandante"],
      where: {
        tenantId: user.tenantId,
        numeroMandante: { not: null },
      },
    }),
  ]);

  const lotti = [
    ...new Set(
      (lottiRows as Array<{ numeroMandante: string | null }>)
        .map((r) => r.numeroMandante?.trim())
        .filter((x): x is string => Boolean(x))
    ),
  ].sort((a, b) => a.localeCompare(b, "it"));

  const { rows, total, meseLabel } = await loadIncassiElenco(
    user,
    filtri,
    mandantiList,
    skip,
    pageSize
  );

  const totPagina = rows.reduce((s, r) => s + r.importoNum, 0);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const queryBase: Record<string, string | undefined> = { ...filtri };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Incassi"
        subtitle={`Elenco incassi registrati · ${meseLabel} · ${total} risultat${total === 1 ? "o" : "i"}`}
      />

      <IncassiElencoFiltriBar
        filtri={filtri}
        operatori={operatori}
        mandanti={mandantiList.map((m) => ({
          id: m.id,
          codice: m.codice,
          ragioneSociale: m.ragioneSociale,
        }))}
        lotti={lotti}
        lottiPerMandato={{}}
        mandantiPerimetri={mandantiList.map((m) => ({
          id: m.id,
          perimetri: m.perimetri,
        }))}
        meseParam={filtri.mese || ""}
      />

      <Card title="Elenco incassi">
        <div className="table-scroll">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--line)] text-xs uppercase text-[var(--muted)]">
                <th className="px-2 py-2">Data</th>
                <th className="px-2 py-2">Pratica</th>
                <th className="px-2 py-2">Cliente</th>
                <th className="px-2 py-2">Mandato</th>
                <th className="px-2 py-2">Perimetro</th>
                <th className="px-2 py-2">Lotto</th>
                <th className="px-2 py-2">Operatore</th>
                <th className="px-2 py-2">Tipo</th>
                <th className="px-2 py-2">Esito</th>
                <th className="px-2 py-2 text-right">Importo</th>
                <th className="px-2 py-2">Ricevuta</th>
                <th className="px-2 py-2">Causale</th>
                <th className="px-2 py-2">Città</th>
                <th className="px-2 py-2">CAP</th>
                <th className="px-2 py-2">Affido</th>
                <th className="px-2 py-2">Scarico</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={16} className="px-2 py-8 text-center text-[var(--muted)]">
                    Nessun incasso con i filtri selezionati.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="border-b border-[var(--line)]/60 hover:bg-[#f8fafc]">
                    <td className="px-2 py-2 whitespace-nowrap">{r.data}</td>
                    <td className="px-2 py-2">
                      <Link
                        href={`/pratiche/${r.praticaId}`}
                        className="font-medium text-[var(--navy)] underline-offset-2 hover:underline"
                      >
                        {r.praticaNumero}
                      </Link>
                    </td>
                    <td className="px-2 py-2">{r.cliente}</td>
                    <td className="px-2 py-2">{r.mandante}</td>
                    <td className="px-2 py-2">{r.perimetro}</td>
                    <td className="px-2 py-2">{r.lotto}</td>
                    <td className="px-2 py-2">{r.operatore}</td>
                    <td className="px-2 py-2">{r.metodo}</td>
                    <td className="px-2 py-2 whitespace-nowrap">{r.modoLabel}</td>
                    <td className="px-2 py-2 text-right font-semibold tabular-nums">
                      {r.importo}
                    </td>
                    <td className="px-2 py-2">{r.ricevuta}</td>
                    <td className="px-2 py-2 max-w-[160px] truncate" title={r.causale}>
                      {r.causale}
                    </td>
                    <td className="px-2 py-2">{r.citta}</td>
                    <td className="px-2 py-2">{r.cap}</td>
                    <td className="px-2 py-2 whitespace-nowrap">{r.dataAffido}</td>
                    <td className="px-2 py-2 whitespace-nowrap">{r.dataScarico}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {rows.length > 0 ? (
          <p className="mt-2 text-xs text-[var(--muted)]">
            Totale pagina: {euro(totPagina)}
          </p>
        ) : null}
      </Card>

      {total > 0 ? (
        <PaginazioneBar
          page={page}
          totalPages={totalPages}
          hrefForPage={(p) => buildIncassiQuery(queryBase, p)}
          right={
            <span className="text-xs font-semibold tabular-nums text-[var(--navy)]">
              {Math.min(skip + pageSize, total)}/{total}
            </span>
          }
        />
      ) : null}
    </div>
  );
}
