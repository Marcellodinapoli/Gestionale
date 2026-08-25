import Link from "next/link";
import {
  COLONNE_CODICI,
  type RigaCodiciMandantePerimetro,
} from "@/lib/codiciMandantePerimetroUi";
import { CODICE_SCARICO_LABELS, type CodiceScarico } from "@/lib/scarico";
import { buildPraticheQuery } from "@/components/PaginazioneBar";

export function CodiciMandantePerimetroTable({
  righe,
  gruppoSenzaPerimetri,
}: {
  righe: RigaCodiciMandantePerimetro[];
  gruppoSenzaPerimetri?: boolean;
}) {
  if (gruppoSenzaPerimetri) {
    return (
      <p className="rounded-xl border border-[var(--line)] bg-white px-3 py-4 text-sm text-[var(--muted)]">
        Nessun perimetro impostato sul gruppo: i conteggi per mandante/perimetro non sono
        disponibili. Configurali in Affidi.
      </p>
    );
  }

  if (!righe.length) {
    return (
      <p className="text-sm text-[var(--muted)]">Nessuna pratica da riepilogare.</p>
    );
  }

  const totali = COLONNE_CODICI.reduce(
    (acc, col) => {
      acc[col.key] = righe.reduce((s, r) => s + r.conteggi[col.key], 0);
      return acc;
    },
    {} as Record<string, number>
  );
  const totaleAffidate = righe.reduce((s, r) => s + r.affidate, 0);
  const totalePratiche = righe.reduce((s, r) => s + r.totale, 0);

  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--line)] bg-white">
      <table className="w-full min-w-[720px] text-sm">
        <thead className="bg-slate-50 text-left text-[var(--muted)]">
          <tr>
            <th className="px-3 py-2">Mandante</th>
            <th className="px-2 py-2">Perimetro</th>
            <th
              className="px-2 py-2 text-center text-xs"
              title="Pratiche affidate a un operatore"
            >
              Affidate
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
          {righe.map((r) => (
            <tr
              key={`${r.mandanteId}|${r.perimetro}`}
              className="border-t border-[var(--line)]"
            >
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
                      ...(r.perimetro !== "—" ? { lotto: r.perimetro } : {}),
                      sitAffido: "affidata",
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
              {COLONNE_CODICI.map((col) => {
                const n = r.conteggi[col.key];
                return (
                  <td key={col.key} className="px-2 py-2 text-center tabular-nums">
                    {n > 0 ? (
                      <Link
                        href={buildPraticheQuery({
                          mandato: r.mandanteId,
                          ...(r.perimetro !== "—" ? { lotto: r.perimetro } : {}),
                          ...(col.key === "ND" ? {} : { codScarico: col.key }),
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
            <td className="px-3 py-2" colSpan={2}>
              Totale
            </td>
            <td className="px-2 py-2 text-center tabular-nums text-[var(--navy)]">
              {totaleAffidate}
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
    </div>
  );
}
