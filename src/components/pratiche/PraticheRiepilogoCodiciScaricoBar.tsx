import {
  descrizioneCodiceRiepilogo,
  type RigaRiepilogoCodiceScarico,
} from "@/lib/praticheRiepilogoCodiciScarico";

export function PraticheRiepilogoCodiciScaricoBar({
  righe,
  totale,
}: {
  righe: RigaRiepilogoCodiceScarico[];
  totale: number;
}) {
  return (
    <div className="mt-1.5 shrink-0 rounded-lg border border-[var(--line)] bg-white px-3 py-2 shadow-sm">
      <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
          Riepilogo codici scarico
        </span>
        <span className="text-xs tabular-nums text-[var(--muted)]">
          {totale} {totale === 1 ? "pratica" : "pratiche"} nel filtro
        </span>
      </div>
      {!righe.length ? (
        <p className="text-xs text-[var(--muted)]">
          Nessuna pratica nel risultato: i conteggi per codice compariranno quando l&apos;elenco
          contiene almeno una posizione.
        </p>
      ) : (
      <div className="flex flex-wrap gap-1.5">
        {righe.map((r) => {
          const hint = descrizioneCodiceRiepilogo(r.codice);
          return (
            <span
              key={r.codice}
              className="inline-flex items-center gap-1.5 rounded-md border border-[#c5d4e3] bg-gradient-to-b from-[#f8fbfd] to-[#eef4f8] px-2 py-1 text-xs leading-none"
              title={hint ? `${r.codice} — ${hint}` : r.codice}
            >
              <span className="font-mono text-[11px] font-semibold tracking-wide text-[var(--navy)]">
                {r.codice}
              </span>
              <span
                className="min-w-[1.25rem] rounded bg-[var(--navy)] px-1 py-0.5 text-center text-[11px] font-bold tabular-nums text-white"
                aria-label={`${r.count} pratiche`}
              >
                {r.count}
              </span>
            </span>
          );
        })}
      </div>
      )}
    </div>
  );
}
