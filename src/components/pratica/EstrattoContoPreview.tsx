import { dataIt, dataItShort, importoIt } from "@/lib/domainFormat";
import { metodoIncassoLabel } from "@/lib/metodoIncasso";

type Debitore = {
  ndg?: string | null;
  codiceFiscale?: string | null;
  nome: string;
  cognome: string;
  telefono?: string | null;
  indirizzo?: string | null;
  citta?: string | null;
  cap?: string | null;
  provincia?: string | null;
};

type Fattura = {
  dataScadenza: Date;
  importo: number;
  pagato: number;
};

type Incasso = {
  id: string;
  data: Date;
  dataScadenza: Date | null;
  capitale: number;
  interessi: number;
  spese: number;
  speseRec: number;
  importo: number;
  modo: string | null;
  causale: string | null;
  metodo: string;
};

export function EstrattoContoPreview({
  debitore,
  numero,
  creditore,
  societa,
  scadenza,
  fatture,
  incassi,
  affidato,
  definito,
  compact,
  flow,
}: {
  debitore: Debitore;
  numero: string;
  creditore: string;
  societa: string;
  scadenza: Date | null;
  fatture: Fattura[];
  incassi: Incasso[];
  affidato: number;
  definito: number;
  compact?: boolean;
  flow?: boolean;
}) {
  const ndg = debitore.ndg || debitore.codiceFiscale || "—";
  const insoluti = fatture.filter((f) => f.importo - f.pagato > 0.009);
  const primaScad = fatture[0]?.dataScadenza || scadenza;
  const ultimaScad = [...fatture].sort(
    (a, b) => b.dataScadenza.getTime() - a.dataScadenza.getTime()
  )[0]?.dataScadenza;
  const ultimoPag = incassi.length ? incassi[incassi.length - 1].data : null;
  const stralciato = Math.max(0, affidato - definito);
  const totMov = incassi.reduce((s, i) => s + i.importo, 0);

  const anagraficaRows: [string, string][] = [
    ["NDG", ndg],
    ["Tipo", "DEBITORE"],
    ["Nominativo", `${debitore.cognome} ${debitore.nome}`.trim()],
    ["Indirizzo", debitore.indirizzo || "—"],
    ["Localita", debitore.citta || "—"],
    ["Cap", debitore.cap || "—"],
    ["Provincia", debitore.provincia || "—"],
  ];

  const praticaRows: [string, string][] = [
    ["CEDENTE", creditore],
    ["CONTRATTO", numero],
    ["GESTIONE", "SR"],
    ["SOCIETA", societa],
    ["PRIMA_SCADENZA", dataIt(primaScad) || "—"],
    ["ULTIMA_SCADENZA", dataIt(ultimaScad) || "—"],
    ["ULTIMO_PAGAMENTO", dataIt(ultimoPag) || "—"],
    ["NR_INSOLUTI", String(insoluti.length)],
    ["IMPORTO AFFIDATO", importoIt(affidato)],
    ["IMPORTO DEFINITO", importoIt(definito)],
    ["IMPORTO STRALCIATO", importoIt(stralciato)],
  ];

  const textCls = compact
    ? "font-mono text-[10px] leading-4 text-[#132033]"
    : "font-mono text-xs leading-6 text-[#132033]";
  const labelW = compact ? "5.5rem" : "140px";
  const praticaLabelW = compact ? "7rem" : "180px";

  return (
    <div
      className={`${flow ? "bg-white" : "h-full min-h-0 overflow-y-auto overflow-x-auto bg-white p-1.5"} ${textCls}`}
    >
      <p>
        NDG = {ndg}
        {debitore.telefono ? `    Tel. ${debitore.telefono}` : ""}
      </p>

      <p className={`${compact ? "mt-1.5" : "mt-3"} font-semibold uppercase`}>
        Altra anagrafica
      </p>
      <dl
        className="mt-0.5 grid gap-x-2"
        style={{ gridTemplateColumns: `${labelW} 1fr` }}
      >
        {anagraficaRows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className={compact ? "text-[9px] uppercase text-[var(--muted)]" : ""}>{k}</dt>
            <dd className={compact ? "truncate" : ""} title={v}>
              {v}
            </dd>
          </div>
        ))}
      </dl>

      <dl
        className={`${compact ? "mt-2" : "mt-4"} grid gap-x-2`}
        style={{ gridTemplateColumns: `${praticaLabelW} 1fr` }}
      >
        {praticaRows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className={compact ? "text-[9px] uppercase text-[var(--muted)]" : ""}>{k}</dt>
            <dd className={compact ? "truncate" : ""} title={v}>
              {v}
            </dd>
          </div>
        ))}
      </dl>

      <p className={`${compact ? "mt-2" : "mt-6"} font-semibold uppercase`}>Movimenti</p>
      <div className="mt-0.5 overflow-x-auto">
        <table className={`w-full min-w-[640px] border-collapse ${compact ? "text-[10px]" : ""}`}>
          <thead>
            <tr className="border-y border-[#132033] text-left">
              <th className="py-0.5 pr-1">Data</th>
              <th className="py-0.5 pr-1">Data Sc.</th>
              <th className="py-0.5 pr-1 text-right">Capitale</th>
              <th className="py-0.5 pr-1 text-right">Interessi</th>
              <th className="py-0.5 pr-1 text-right">Spese</th>
              <th className="py-0.5 pr-1 text-right">SpeseRec</th>
              <th className="py-0.5 pr-1 text-right">Totale</th>
              <th className="py-0.5 pr-1">Mo</th>
              <th className="py-0.5">Causale</th>
            </tr>
          </thead>
          <tbody>
            {incassi.map((i) => (
              <tr key={i.id}>
                <td className="pr-1 whitespace-nowrap">{dataItShort(i.data)}</td>
                <td className="pr-1 whitespace-nowrap">
                  {dataItShort(i.dataScadenza || i.data)}
                </td>
                <td className="pr-1 text-right whitespace-nowrap">{importoIt(i.capitale)}</td>
                <td className="pr-1 text-right whitespace-nowrap">{importoIt(i.interessi)}</td>
                <td className="pr-1 text-right whitespace-nowrap">{importoIt(i.spese)}</td>
                <td className="pr-1 text-right whitespace-nowrap">{importoIt(i.speseRec)}</td>
                <td className="pr-1 text-right whitespace-nowrap">{importoIt(i.importo)}</td>
                <td className="pr-1">{i.modo || "VE"}</td>
                <td className="max-w-[120px] truncate" title={i.causale || metodoIncassoLabel(i.metodo)}>
                  {i.causale || metodoIncassoLabel(i.metodo)}
                </td>
              </tr>
            ))}
            {!incassi.length ? (
              <tr>
                <td colSpan={9} className="py-2 text-[var(--muted)]">
                  Nessun movimento in estratto.
                </td>
              </tr>
            ) : null}
          </tbody>
          {incassi.length ? (
            <tfoot>
              <tr className="border-t border-[#132033] font-semibold">
                <td colSpan={6}>Totale</td>
                <td className="pr-1 text-right">{importoIt(totMov)}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
    </div>
  );
}
