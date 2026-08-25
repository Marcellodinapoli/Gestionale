import Link from "next/link";
import {
  buildAffidiHref,
  buildCaricoOperatori,
  type OperatoreCarico,
  type PraticaAffido,
} from "@/components/affidi/AffidiCaricoOperatori";
import {
  chiavePerimetro,
  filtraPratichePerPerimetro,
  type PerimetroGruppoRef,
} from "@/lib/affidiPerimetro";

type PraticaPerimetro = {
  mandanteId: string;
  numeroMandante?: string | null;
  assegnatarioId: string | null;
};

export function AffidiPerimetroOverview({
  refs,
  daAssegnare,
  affidate,
  membri,
}: {
  refs: PerimetroGruppoRef[];
  daAssegnare: PraticaPerimetro[];
  affidate: PraticaAffido[];
  membri: Array<{ id: string; name: string; role: string }>;
}) {
  if (!refs.length) {
    return (
      <p className="rounded-xl border border-[var(--line)] bg-white px-4 py-6 text-sm text-[var(--muted)]">
        Nessun mandato/perimetro configurato sul gruppo. Usa{" "}
        <span className="font-medium text-[var(--navy)]">Modifica gruppo</span> per assegnare i
        perimetri gestiti dagli operatori.
      </p>
    );
  }

  const totDaAffidare = daAssegnare.length;
  const totAffidate = affidate.filter((p) => p.assegnatarioId).length;

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--muted)]">
        {refs.length} perimetri del gruppo · {totDaAffidare} da affidare · {totAffidate} affidate
        agli operatori del gruppo. Usa <strong className="text-[var(--navy)]">Affida / riaffida</strong>{" "}
        per gestire anche le pratiche già in carico (definitivo o temporaneo).
      </p>
      <div className="space-y-4">
        {refs.map((ref) => {
          const da = filtraPratichePerPerimetro(daAssegnare, ref);
          const aff = filtraPratichePerPerimetro(affidate, ref);
          const carico: OperatoreCarico[] = buildCaricoOperatori(membri, aff);
          const aperte = carico.reduce((s, o) => s + o.totAperte, 0);
          const href = buildAffidiHref({
            mandato: ref.mandanteId,
            perimetro: ref.perimetro,
          });
          const hrefAffida = buildAffidiHref({
            mandato: ref.mandanteId,
            perimetro: ref.perimetro,
            sezione: "affida",
          });

          return (
            <section
              key={chiavePerimetro(ref.mandanteId, ref.perimetro)}
              className="overflow-hidden rounded-xl border-2 border-[#1a4f7a]/25 bg-white shadow-sm"
            >
              <header className="border-b border-[#1a4f7a]/20 bg-[#1a4f7a] px-4 py-2.5 text-white">
                <p className="text-[10px] font-semibold uppercase tracking-widest opacity-90">
                  Mandato · Perimetro
                </p>
                <h3 className="text-base font-bold tracking-tight">
                  {ref.mandanteCodice}
                  <span className="ml-2 text-sm font-normal opacity-90">· {ref.perimetroLabel}</span>
                </h3>
                <p className="mt-0.5 text-xs opacity-80">{ref.mandanteNome}</p>
              </header>
              <div className="grid gap-3 px-4 py-3 sm:grid-cols-3">
                <div className="rounded-lg border border-[var(--line)] bg-[#f8fafc] px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase text-[var(--muted)]">
                    Da affidare
                  </p>
                  <Link
                    href={href}
                    className="mt-0.5 block tabular-nums text-2xl font-bold text-[var(--navy)] hover:text-[var(--accent)]"
                  >
                    {da.length}
                  </Link>
                </div>
                <div className="rounded-lg border border-[var(--line)] bg-[#f8fafc] px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase text-[var(--muted)]">
                    In coda operatori
                  </p>
                  <Link
                    href={href}
                    className="mt-0.5 block tabular-nums text-2xl font-bold text-[var(--navy)] hover:text-[var(--accent)]"
                  >
                    {aperte}
                  </Link>
                </div>
                <div className="flex flex-col items-end justify-end gap-2 pb-1">
                  <Link
                    href={hrefAffida}
                    className="rounded-lg bg-[var(--navy)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
                  >
                    Affida / riaffida
                  </Link>
                  <Link
                    href={href}
                    className="text-xs text-[var(--accent)] underline"
                  >
                    Carico operatori
                  </Link>
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
