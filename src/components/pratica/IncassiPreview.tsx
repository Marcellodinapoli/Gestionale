import { dataIt, importoIt } from "@/lib/domainFormat";
import { metodoIncassoLabel } from "@/lib/metodoIncasso";

type Incasso = {
  id: string;
  data: Date;
  metodo: string;
  modo: string | null;
  importo: number;
  capitale: number;
  interessi: number;
  spese: number;
  causale: string | null;
  user?: { name: string } | null;
};

export function IncassiPreview({
  incassi,
  compact,
  flow,
}: {
  incassi: Incasso[];
  compact?: boolean;
  flow?: boolean;
}) {
  const tot = incassi.reduce((s, i) => s + i.importo, 0);
  const textCls = compact
    ? "font-mono text-[10px] leading-4 text-[#132033]"
    : "font-mono text-[13px] leading-6 text-[#132033]";

  return (
    <div className={`${flow ? "bg-white" : "h-full min-h-0 overflow-y-auto overflow-x-auto bg-white p-1.5"} ${textCls}`}>
      <p className={`${compact ? "mb-1" : "mb-2"} font-semibold uppercase`}>
        Incassi registrati
      </p>
      <table className={`w-full min-w-[640px] border-collapse ${compact ? "text-[10px]" : ""}`}>
        <thead>
          <tr className="border-y border-[#132033] text-left">
            <th className="py-0.5 pr-1">Data</th>
            <th className="py-0.5 pr-1">Metodo</th>
            <th className="py-0.5 pr-1">Mo</th>
            <th className="py-0.5 pr-1 text-right">Importo</th>
            <th className="py-0.5 pr-1 text-right">Capitale</th>
            <th className="py-0.5 pr-1 text-right">Interessi</th>
            <th className="py-0.5 pr-1 text-right">Spese</th>
            <th className="py-0.5 pr-1">Causale</th>
            <th className="py-0.5">Operatore</th>
          </tr>
        </thead>
        <tbody>
          {incassi.map((i) => (
            <tr key={i.id}>
              <td className="pr-1 whitespace-nowrap">{dataIt(i.data)}</td>
              <td className="pr-1">{metodoIncassoLabel(i.metodo)}</td>
              <td className="pr-1">{i.modo || "VE"}</td>
              <td className="pr-1 text-right whitespace-nowrap">{importoIt(i.importo)}</td>
              <td className="pr-1 text-right whitespace-nowrap">{importoIt(i.capitale)}</td>
              <td className="pr-1 text-right whitespace-nowrap">{importoIt(i.interessi)}</td>
              <td className="pr-1 text-right whitespace-nowrap">{importoIt(i.spese)}</td>
              <td className="max-w-[100px] truncate pr-1" title={i.causale || undefined}>
                {i.causale || "—"}
              </td>
              <td className="truncate" title={i.user?.name}>
                {i.user?.name || "—"}
              </td>
            </tr>
          ))}
          {!incassi.length ? (
            <tr>
              <td colSpan={9} className="py-2 text-[var(--muted)]">
                Nessun incasso registrato.
              </td>
            </tr>
          ) : null}
        </tbody>
        {incassi.length ? (
          <tfoot>
            <tr className="border-t border-[#132033] font-semibold">
              <td colSpan={3}>Totale</td>
              <td className="pr-1 text-right">{importoIt(tot)}</td>
              <td colSpan={5} />
            </tr>
          </tfoot>
        ) : null}
      </table>
    </div>
  );
}
