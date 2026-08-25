import Link from "next/link";
import type { RigaInLavorazionePerimetro } from "@/lib/codiciMandantePerimetro";
import { buildPraticheQuery } from "@/components/PaginazioneBar";

const base =
  "rounded-lg border border-[var(--line)] bg-white px-3 py-2.5 shadow-sm border-l-[3px] border-l-amber-500";

export function InLavorazionePerimetroCard({
  righe,
  gruppoSenzaPerimetri,
}: {
  righe: RigaInLavorazionePerimetro[];
  /** true = operatore in gruppo ma senza perimetri configurati */
  gruppoSenzaPerimetri?: boolean;
}) {
  const totale = righe.reduce((s, r) => s + r.count, 0);

  return (
    <section className={base}>
      <p className="truncate text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
        In lavorazione per perimetro
      </p>
      <p className="mt-0.5 tabular-nums text-2xl font-bold leading-tight text-[var(--navy)]">
        {totale}
      </p>
      {gruppoSenzaPerimetri ? (
        <p className="mt-1 text-xs text-[var(--muted)]">
          Nessun perimetro impostato sul gruppo
        </p>
      ) : righe.length ? (
        <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto">
          {righe.map((r) => (
            <li key={`${r.mandanteId}|${r.perimetro}`}>
              <Link
                href={buildPraticheQuery({
                  mandato: r.mandanteId,
                  ...(r.perimetro !== "—" ? { lotto: r.perimetro } : {}),
                })}
                className="flex items-baseline justify-between gap-2 text-sm leading-tight hover:text-[var(--accent)]"
              >
                <span className="min-w-0 truncate">
                  <span className="font-medium text-[var(--navy)]">{r.mandanteCodice}</span>
                  <span className="ml-1 text-[var(--muted)]">{r.perimetro}</span>
                </span>
                <span className="shrink-0 tabular-nums font-bold text-[var(--navy)]">
                  {r.count}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-sm text-[var(--muted)]">Nessuna</p>
      )}
    </section>
  );
}
