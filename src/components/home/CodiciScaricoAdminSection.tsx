import { CODICE_SCARICO_LABELS, CODICI_SCARICO, type CodiceScarico } from "@/lib/scarico";

type RigaCodiciScaricoAdmin = {
  codice: string;
  oggi: number;
  mese: number;
};

export function CodiciScaricoAdminSection({
  righe,
  filtroLabel,
  meseLabel,
}: {
  righe: RigaCodiciScaricoAdmin[];
  filtroLabel: string;
  meseLabel: string;
}) {
  const righeOrdinate = CODICI_SCARICO.map((codice) => {
    const hit = righe.find((r) => r.codice === codice);
    return { codice, oggi: hit?.oggi ?? 0, mese: hit?.mese ?? 0 };
  });
  const totOggi = righeOrdinate.reduce((s, r) => s + r.oggi, 0);
  const totMese = righeOrdinate.reduce((s, r) => s + r.mese, 0);

  return (
    <div>
      <div className="mb-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
          Codici scarico
        </h2>
        <p className="mt-0.5 text-xs text-[var(--muted)]">
          {filtroLabel} · Mese: {meseLabel}
        </p>
      </div>
      <div className="overflow-x-auto rounded-xl border border-[var(--line)] bg-white p-4">
        <table className="w-full text-sm">
          <thead className="text-left text-[var(--muted)]">
            <tr>
              <th className="py-1.5">Codice</th>
              <th className="py-1.5">Descrizione</th>
              <th className="text-right">Oggi</th>
              <th className="text-right capitalize">Mese ({meseLabel})</th>
            </tr>
          </thead>
          <tbody>
            {righeOrdinate.map((r) => (
              <tr key={r.codice} className="border-t border-[var(--line)]">
                <td className="py-2 font-mono font-semibold">{r.codice}</td>
                <td className="py-2 text-[var(--muted)]">
                  {CODICE_SCARICO_LABELS[r.codice as CodiceScarico]}
                </td>
                <td className="py-2 text-right tabular-nums">{r.oggi}</td>
                <td className="py-2 text-right font-semibold tabular-nums text-[var(--navy)]">
                  {r.mese}
                </td>
              </tr>
            ))}
            <tr className="border-t-2 border-[var(--navy)] font-semibold">
              <td className="py-2" colSpan={2}>
                Somma pezzi
              </td>
              <td className="text-right tabular-nums">{totOggi}</td>
              <td className="text-right tabular-nums">{totMese}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
