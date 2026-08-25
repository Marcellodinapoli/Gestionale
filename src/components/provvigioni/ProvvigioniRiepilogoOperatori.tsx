import Link from "next/link";
import { euro } from "@/lib/domain";

export type RiepilogoOperatoreProvvigioni = {
  id: string;
  name: string;
  importo: number;
  count: number;
  maturate: number;
  liquidate: number;
  isSelf?: boolean;
};

export function ProvvigioniRiepilogoOperatori({
  items,
  mese,
  operatoreSelezionato,
}: {
  items: RiepilogoOperatoreProvvigioni[];
  mese: string;
  operatoreSelezionato?: string;
}) {
  if (!items.length) return null;

  const hrefOperatore = (id?: string) => {
    const sp = new URLSearchParams({ mese });
    if (id) sp.set("operatore", id);
    return `/provigioni?${sp.toString()}`;
  };

  return (
    <div className="mb-3 shrink-0">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
          Totale per operatore
        </p>
        {operatoreSelezionato ? (
          <Link
            href={hrefOperatore()}
            className="text-xs text-[var(--accent)] underline"
          >
            Mostra tutti il team
          </Link>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => {
          const attivo = operatoreSelezionato === item.id;
          return (
            <Link
              key={item.id}
              href={hrefOperatore(item.id)}
              className={`min-w-[140px] rounded-lg border bg-white px-3 py-2.5 shadow-sm transition hover:border-[var(--accent)] ${
                attivo
                  ? "border-[var(--navy)] ring-2 ring-[var(--navy)]/20"
                  : "border-[var(--line)]"
              }`}
            >
              <p className="truncate text-sm font-semibold text-[var(--navy)]">
                {item.name}
                {item.isSelf ? " (tu)" : ""}
              </p>
              <p className="mt-0.5 text-xl font-bold tabular-nums text-[var(--navy)]">
                {euro(item.importo)}
              </p>
              <p className="mt-1 text-[10px] leading-snug text-[var(--muted)]">
                {item.count} mov. · {euro(item.maturate)} mat. · {euro(item.liquidate)} liq.
              </p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
