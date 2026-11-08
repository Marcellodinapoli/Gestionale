import Link from "next/link";
import {
  COLONNE_CODICI,
  type RigaCodiciMandantePerimetro,
  type RigaCodiciMandantePerimetroOperatore,
} from "@/lib/codiciMandantePerimetroUi";
import { CODICE_SCARICO_LABELS, type CodiceScarico } from "@/lib/scarico";
import { buildPraticheQuery } from "@/components/PaginazioneBar";

function CodiciTableBody({
  righe,
  operatoreId,
  operatoreNome,
  nascondiColonnaScadute,
}: {
  righe: RigaCodiciMandantePerimetro[];
  operatoreId?: string;
  /** In vista gruppo: colonna Operatore prima di Mandante. */
  operatoreNome?: string;
  nascondiColonnaScadute?: boolean;
}) {
  const totali = COLONNE_CODICI.reduce(
    (acc, col) => {
      acc[col.key] = righe.reduce((s, r) => s + r.conteggi[col.key], 0);
      return acc;
    },
    {} as Record<string, number>
  );
  const totaleAffidate = righe.reduce((s, r) => s + r.affidate, 0);
  const totaleScadute = righe.reduce((s, r) => s + r.scadute, 0);
  const totaleInLavorazione = righe.reduce((s, r) => s + r.inLavorazione, 0);
  const totalePratiche = righe.reduce((s, r) => s + r.totale, 0);

  return (
    <table className="w-full min-w-[720px] text-sm">
      <thead className="bg-slate-50 text-left text-[var(--muted)]">
        <tr>
          {operatoreNome ? <th className="px-3 py-2">Operatore</th> : null}
          <th className="px-3 py-2">Mandante</th>
          <th className="px-2 py-2">Perimetro</th>
          <th
            className="px-2 py-2 text-center text-xs"
            title="Pratiche affidate a un operatore"
          >
            Affidate
          </th>
          {nascondiColonnaScadute ? null : (
            <th className="px-2 py-2 text-center text-xs" title="Scadenza già passata">
              Scadute
            </th>
          )}
          <th className="px-2 py-2 text-center text-xs" title="Stato affidata, in lavorazione o promessa">
            In lavorazione
          </th>
          {COLONNE_CODICI.map((col) => (
            <th
              key={col.key}
              className="px-2 py-2 text-center font-mono text-xs"
              title={
                col.key === "ND"
                  ? "Senza codice scarico"
                  : CODICE_SCARICO_LABELS[col.key as CodiceScarico]
              }
            >
              {col.label}
            </th>
          ))}
          <th className="px-3 py-2 text-right">Totale</th>
        </tr>
      </thead>
      <tbody>
        {righe.map((r, rowIndex) => (
          <tr
            key={`${operatoreId ?? ""}|${r.mandanteId}|${r.perimetro}`}
            className="border-t border-[var(--line)]"
          >
            {operatoreNome && rowIndex === 0 ? (
              <td
                className="px-3 py-2 align-top text-sm font-semibold text-[var(--navy)]"
                rowSpan={righe.length}
              >
                {operatoreNome}
              </td>
            ) : null}
            <td className="px-3 py-2">
              <Link
                href={`/mandanti/${r.mandanteId}`}
                className="font-medium text-[var(--accent)] underline"
              >
                {r.mandanteCodice}
              </Link>
              <span className="ml-1.5 text-[var(--muted)]">{r.mandanteNome}</span>
            </td>
            <td className="px-2 py-2 text-[var(--navy)]">{r.perimetro}</td>
            <td className="px-2 py-2 text-center tabular-nums">
              {r.affidate > 0 ? (
                <Link
                  href={buildPraticheQuery({
                    mandato: r.mandanteId,
                    ...(r.perimetro !== "—" ? { perimetro: r.perimetro } : {}),
                    sitAffido: "affidata",
                    ...(operatoreId ? { operatore: operatoreId } : {}),
                  })}
                  className="font-semibold text-[var(--navy)] hover:text-[var(--accent)]"
                  title="Pratiche affidate"
                >
                  {r.affidate}
                </Link>
                ) : (
                  <span className="text-[var(--muted)]">0</span>
                )}
              </td>
              {nascondiColonnaScadute ? null : (
                <td className="px-2 py-2 text-center tabular-nums">
                  {r.scadute > 0 ? (
                    <span className="font-semibold text-[var(--navy)]">{r.scadute}</span>
                  ) : (
                    <span className="text-[var(--muted)]">0</span>
                  )}
                </td>
              )}
              <td className="px-2 py-2 text-center tabular-nums">
                {r.inLavorazione > 0 ? (
                  <span className="font-semibold text-[var(--navy)]">{r.inLavorazione}</span>
                ) : (
                  <span className="text-[var(--muted)]">0</span>
                )}
              </td>
              {COLONNE_CODICI.map((col) => {
              const n = r.conteggi[col.key];
              return (
                <td key={col.key} className="px-2 py-2 text-center tabular-nums">
                  {n > 0 ? (
                    <Link
                      href={buildPraticheQuery({
                        mandato: r.mandanteId,
                        ...(r.perimetro !== "—" ? { perimetro: r.perimetro } : {}),
                        ...(col.key === "ND" ? { codScarico: "NULL" } : { codScarico: col.key }),
                        ...(operatoreId ? { operatore: operatoreId } : {}),
                      })}
                      className="font-semibold text-[var(--navy)] hover:text-[var(--accent)]"
                      title={
                        col.key === "ND"
                          ? "Senza codice"
                          : CODICE_SCARICO_LABELS[col.key as CodiceScarico]
                      }
                    >
                      {n}
                    </Link>
                  ) : (
                    <span className="text-[var(--muted)]">0</span>
                  )}
                </td>
              );
            })}
            <td className="px-3 py-2 text-right font-semibold tabular-nums text-[var(--navy)]">
              {r.totale}
            </td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr className="border-t-2 border-[var(--line)] bg-slate-50 font-semibold">
          <td className="px-3 py-2" colSpan={operatoreNome ? 3 : 2}>
            Totale
          </td>
            <td className="px-2 py-2 text-center tabular-nums text-[var(--navy)]">
              {totaleAffidate}
            </td>
            {nascondiColonnaScadute ? null : (
              <td className="px-2 py-2 text-center tabular-nums text-[var(--navy)]">
                {totaleScadute}
              </td>
            )}
            <td className="px-2 py-2 text-center tabular-nums text-[var(--navy)]">
              {totaleInLavorazione}
            </td>
            {COLONNE_CODICI.map((col) => (
            <td
              key={col.key}
              className="px-2 py-2 text-center tabular-nums text-[var(--navy)]"
            >
              {totali[col.key] || 0}
            </td>
          ))}
          <td className="px-3 py-2 text-right tabular-nums text-[var(--navy)]">
            {totalePratiche}
          </td>
        </tr>
      </tfoot>
    </table>
  );
}

export function CodiciMandantePerimetroTable({
  righe,
  righePerOperatore,
  nascondiColonnaScadute,
}: {
  righe: RigaCodiciMandantePerimetro[];
  righePerOperatore?: RigaCodiciMandantePerimetroOperatore[];
  nascondiColonnaScadute?: boolean;
}) {
  const hasOperatore = Boolean(righePerOperatore?.length);
  const hasData = hasOperatore || righe.length > 0;

  if (!hasData) {
    return <p className="text-sm text-[var(--muted)]">Nessuna pratica da riepilogare.</p>;
  }

  if (hasOperatore) {
    const byOp = new Map<string, RigaCodiciMandantePerimetroOperatore[]>();
    for (const r of righePerOperatore!) {
      const list = byOp.get(r.operatoreId) ?? [];
      list.push(r);
      byOp.set(r.operatoreId, list);
    }
    const blocks = [...byOp.entries()].sort((a, b) =>
      (a[1][0]?.operatoreNome ?? "").localeCompare(b[1][0]?.operatoreNome ?? "", "it")
    );

    return (
      <div className="space-y-4">
        {blocks.map(([operatoreId, opRighe]) => (
          <div key={operatoreId} className="overflow-x-auto rounded-xl border border-[var(--line)] bg-white">
            <CodiciTableBody
              righe={opRighe}
              operatoreId={operatoreId}
              operatoreNome={opRighe[0]?.operatoreNome ?? "—"}
              nascondiColonnaScadute={nascondiColonnaScadute}
            />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--line)] bg-white">
      <CodiciTableBody righe={righe} nascondiColonnaScadute={nascondiColonnaScadute} />
    </div>
  );
}
