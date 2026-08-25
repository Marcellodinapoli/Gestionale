import Link from "next/link";

/** Banner quando Amministrazione non ha sede di appartenenza (serve per ricavi/fatturati). */
export function MissingSedeBanner() {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      <p className="font-semibold">Sede di appartenenza mancante</p>
      <p className="mt-1 text-[var(--muted)]">
        Puoi gestire e consultare le altre sedi, ma per vedere ricavi e fatturati della tua
        sede assegna una sede al tuo account in{" "}
        <Link href="/operatori" className="font-semibold text-[var(--navy)] underline">
          Operatori
        </Link>
        .
      </p>
    </div>
  );
}

/** Avviso: ricavi/fatturati nascosti fuori dalla propria sede. */
export function RicaviAltreSediNascostiBanner({
  sedeNomePropria,
}: {
  sedeNomePropria?: string | null;
}) {
  return (
    <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-[var(--navy)]">
      <p className="font-semibold">Ricavi e fatturati nascosti</p>
      <p className="mt-1 text-xs text-[var(--muted)]">
        Per le altre sedi vedi solo i dati operativi. Gli importi (affidato, incassato,
        fatturati) sono visibili solo
        {sedeNomePropria ? (
          <>
            {" "}
            filtrando la tua sede <strong>{sedeNomePropria}</strong>
          </>
        ) : (
          " per la tua sede di appartenenza"
        )}
        .
      </p>
    </div>
  );
}
