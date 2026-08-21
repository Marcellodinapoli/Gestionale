import Link from "next/link";
import { LavorateDataPicker } from "@/components/home/LavorateDataPicker";
import { CODICE_SCARICO_LABELS } from "@/lib/scarico";
import type {
  OperatoreLavorateGiorno,
  RiepilogoCodiciLavorazione,
} from "@/lib/lavorateOggi";

const base =
  "rounded-lg border border-[var(--line)] bg-white px-3 py-2.5 shadow-sm border-l-[3px] border-l-[var(--accent)]";

export function LavorateGiornoKpi({
  title,
  hint,
  href,
  dataIso,
  operatori,
  codiciLavorazione,
}: {
  title: string;
  hint: string;
  href: string;
  dataIso: string;
  operatori: OperatoreLavorateGiorno[];
  codiciLavorazione: RiepilogoCodiciLavorazione;
}) {
  const { codici, senzaCodice, totalePratiche } = codiciLavorazione;
  const hasCodiciDetail = codici.length > 0 || senzaCodice > 0;

  return (
    <div className={base}>
      <Link href={href} className="block hover:opacity-90">
        <p className="truncate text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
          {title}
        </p>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
              Per operatore
            </p>
            {operatori.length ? (
              <ul className="mt-1 space-y-0.5">
                {operatori.map((op) => (
                  <li
                    key={op.userId}
                    className="flex items-baseline justify-between gap-2 text-sm leading-tight"
                  >
                    <span className="truncate font-medium text-[var(--navy)]" title={op.name}>
                      .{op.sigla}
                      <span className="ml-1 hidden font-normal text-[var(--muted)] sm:inline">
                        {op.name}
                      </span>
                    </span>
                    <span className="shrink-0 tabular-nums text-lg font-bold text-[var(--navy)]">
                      {op.count}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-sm text-[var(--muted)]">Nessuna pratica lavorata</p>
            )}
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
              Dettaglio codici scarico
            </p>
            {hasCodiciDetail ? (
              <ul className="mt-1 space-y-0.5">
                <li
                  className="flex items-baseline justify-between gap-2 text-sm leading-tight"
                  title="Pratiche non ancora lavorate / senza codice scarico"
                >
                  <span className="font-mono font-semibold text-[var(--muted)]">N/D</span>
                  <span className="shrink-0 tabular-nums text-lg font-bold text-[var(--navy)]">
                    {senzaCodice}
                  </span>
                </li>
                {codici.map(({ codice, pratiche }) => (
                  <li
                    key={codice}
                    className="flex items-baseline justify-between gap-2 text-sm leading-tight"
                    title={CODICE_SCARICO_LABELS[codice]}
                  >
                    <span className="font-mono font-semibold text-[var(--navy)]">{codice}</span>
                    <span className="shrink-0 tabular-nums text-lg font-bold text-[var(--navy)]">
                      {pratiche}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-sm text-[var(--muted)]">Nessuna pratica in portafoglio</p>
            )}
            <p className="mt-1.5 text-[10px] text-[var(--muted)]">
              {senzaCodice
                ? `${senzaCodice === 1 ? "1 pratica" : `${senzaCodice} pratiche`} senza codice (N/D)`
                : "Nessuna pratica senza codice"}
              {totalePratiche
                ? ` · ${totalePratiche === 1 ? "1" : totalePratiche} con cambio codice oggi`
                : ""}
            </p>
          </div>
        </div>
        <p className="mt-2 truncate text-[11px] text-[var(--muted)]">{hint}</p>
      </Link>
      <LavorateDataPicker value={dataIso} home />
    </div>
  );
}
