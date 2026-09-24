import Link from "next/link";
import { notFound } from "next/navigation";
import { requireNavPage } from "@/lib/guard";
import { can, STATO_LABELS } from "@/lib/permissions";
import { euro, dataIt } from "@/lib/domain";
import { Card, PageHeader } from "@/components/ui";
import { PortafoglioForm } from "@/components/portafogli/PortafoglioForm";
import { collegaLottoPortafoglioAction } from "@/actions/portafogli";
import {
  getPortafoglio,
  getPortafoglioKpi,
  listImportBatchTenant,
  listPratichePortafoglio,
} from "@/lib/portafogli/repo";
import { PORTAFOGLIO_STATO_LABELS, PORTAFOGLIO_TIPO_LABELS } from "@/lib/portafogli/types";

export default async function PortafoglioSchedaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireNavPage("portafogli");
  const { id } = await params;
  const book = await getPortafoglio(user, id);
  if (!book) notFound();

  const [kpi, pratiche, lotti] = await Promise.all([
    getPortafoglioKpi(user, book.id),
    listPratichePortafoglio(user, book.id),
    listImportBatchTenant(user),
  ]);
  const canManage = can(user, "portafogli:manage");
  const costo = (book.prezzoPagato || 0) + (book.speseAcquisto || 0);
  const vsPrezzo = costo > 0 ? (kpi.incassato / costo) * 100 : null;
  const atteso = book.recuperoAtteso;
  const scostamento = atteso != null ? kpi.incassato - atteso : null;
  const scostamentoPct =
    atteso != null && atteso !== 0 ? (scostamento! / atteso) * 100 : null;

  return (
    <div className="space-y-4">
      <PageHeader
        title={book.nome}
        subtitle={`${PORTAFOGLIO_TIPO_LABELS[book.tipo]} · ${PORTAFOGLIO_STATO_LABELS[book.stato]}${
          book.venditore ? ` · ${book.venditore}` : ""
        }${book.servicer ? ` · gestore ${book.servicer}` : ""}`}
        action={
          <Link href="/portafogli" className="text-sm font-semibold text-[var(--navy)] underline">
            Tutti i portafogli
          </Link>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Card title="Prezzo pagato">
          <p className="text-2xl font-bold tabular-nums text-[var(--navy)]">
            {book.prezzoPagato != null ? euro(book.prezzoPagato) : "—"}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Spese {euro(book.speseAcquisto)}
          </p>
        </Card>
        <Card title="Incassato">
          <p className="text-2xl font-bold tabular-nums text-[var(--navy)]">
            {euro(kpi.incassato)}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {vsPrezzo != null ? `${vsPrezzo.toFixed(1)}% sul costo` : "Senza prezzo non si calcola il recupero"}
          </p>
        </Card>
        <Card title="Recupero atteso">
          <p className="text-2xl font-bold tabular-nums text-[var(--navy)]">
            {atteso != null ? euro(atteso) : "—"}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Target da piano di acquisto
          </p>
        </Card>
        <Card title="Scostamento">
          <p
            className={`text-2xl font-bold tabular-nums ${
              scostamento == null
                ? "text-[var(--navy)]"
                : scostamento >= 0
                  ? "text-emerald-700"
                  : "text-rose-700"
            }`}
          >
            {scostamento == null
              ? "—"
              : `${scostamento > 0 ? "+" : ""}${euro(scostamento)}`}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {scostamento == null
              ? "Inserisci il recupero atteso per il confronto"
              : scostamentoPct != null
                ? `${scostamentoPct > 0 ? "+" : ""}${scostamentoPct.toFixed(1)}% vs atteso`
                : "Effettivo − atteso"}
          </p>
        </Card>
        <Card title="Residuo pratiche">
          <p className="text-2xl font-bold tabular-nums text-[var(--navy)]">
            {euro(kpi.residuo)}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {kpi.nPratiche} pratiche · nominale {euro(book.nominaleDichiarato)}
          </p>
        </Card>
      </div>

      <Card title="Lavorazione">
        {kpi.perStato.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">Nessuna pratica collegata.</p>
        ) : (
          <ul className="flex flex-wrap gap-2 text-sm">
            {kpi.perStato.map((s) => (
              <li
                key={s.stato}
                className="rounded-full border border-[var(--line)] bg-[#f8fafc] px-3 py-1"
              >
                {STATO_LABELS[s.stato] || s.stato}:{" "}
                <span className="font-semibold tabular-nums">{s.count}</span>
              </li>
            ))}
          </ul>
        )}
        {book.dataCutoff || book.dataAcquisto ? (
          <p className="mt-3 text-xs text-[var(--muted)]">
            {book.dataCutoff ? `Cut-off ${dataIt(book.dataCutoff)}` : ""}
            {book.dataCutoff && book.dataAcquisto ? " · " : ""}
            {book.dataAcquisto ? `Acquisto / closing ${dataIt(book.dataAcquisto)}` : ""}
          </p>
        ) : null}
      </Card>

      {canManage ? (
        <Card title="Collega lotto import">
          <p className="mb-3 text-sm text-[var(--muted)]">
            Aggancia le pratiche di un import già fatto in questa azienda. L’import resta quello di sempre.
          </p>
          {lotti.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">
              Nessun lotto import. Carica le pratiche da{" "}
              <Link href="/import" className="font-semibold underline">
                Import
              </Link>
              .
            </p>
          ) : (
            <form action={collegaLottoPortafoglioAction} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="portafoglioId" value={book.id} />
              <label className="min-w-[16rem] flex-1 text-sm">
                <span className="mb-1 block text-[10px] font-semibold uppercase text-[var(--muted)]">
                  Lotto
                </span>
                <select
                  name="importBatchId"
                  required
                  className="h-9 w-full rounded-lg border border-[var(--line)] px-3 text-sm"
                >
                  {lotti.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.lotto || "senza lotto"} · {l.perimetro || "—"} · {l.nPratiche} pr. ·{" "}
                      {dataIt(l.createdAt)}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="submit"
                className="h-9 rounded-lg bg-[var(--navy)] px-4 text-sm font-semibold text-white hover:opacity-90"
              >
                Collega
              </button>
            </form>
          )}
        </Card>
      ) : null}

      <Card title="Pratiche del book">
        {pratiche.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">Nessuna pratica agganciata a questo portafoglio.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-[var(--muted)]">
              <tr>
                <th className="py-2">Numero</th>
                <th>Debitore</th>
                <th>Stato</th>
                <th className="text-right">Residuo</th>
                <th className="text-right">Incassato</th>
              </tr>
            </thead>
            <tbody>
              {pratiche.map((p) => (
                <tr key={p.id} className="border-t border-[var(--line)]">
                  <td className="py-2">
                    <Link href={`/pratiche/${p.id}`} className="font-medium text-[var(--accent)] underline">
                      {p.numero}
                    </Link>
                  </td>
                  <td>{p.debitore || "—"}</td>
                  <td>{STATO_LABELS[p.stato] || p.stato}</td>
                  <td className="text-right tabular-nums">{euro(p.residuo)}</td>
                  <td className="text-right tabular-nums">{euro(p.totIncassato)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {canManage ? (
        <Card title="Dati acquisto">
          <PortafoglioForm initial={book} />
        </Card>
      ) : null}
    </div>
  );
}
