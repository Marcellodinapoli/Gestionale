"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { dataIt, importoIt } from "@/lib/domainFormat";
import { addFatturaAction } from "@/actions/core";

export type FatturaInsoluta = {
  id: string;
  numero: string;
  causale: string | null;
  dataFattura: Date;
  dataScadenza: Date;
  importo: number;
  pagato: number;
};

export function FattureInsolutePreview({
  praticaId,
  fatture,
  canEdit,
  compact,
}: {
  praticaId: string;
  fatture: FatturaInsoluta[];
  canEdit?: boolean;
  compact?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);

  const totImp = fatture.reduce((s, f) => s + f.importo, 0);
  const totPag = fatture.reduce((s, f) => s + f.pagato, 0);
  const totSaldo = totImp - totPag;
  const oggi = new Date();
  const scaduto = fatture.reduce((s, f) => {
    const saldo = f.importo - f.pagato;
    return s + (saldo > 0 && f.dataScadenza < oggi ? saldo : 0);
  }, 0);

  const textCls = compact
    ? "font-mono text-[10px] leading-4 text-[#132033]"
    : "font-mono text-[13px] leading-6 text-[#132033]";
  const inputCls =
    "h-6 min-w-0 rounded border border-[var(--line)] bg-white px-1 text-[10px] text-[#132033]";

  async function onSubmit(formData: FormData) {
    setError(null);
    try {
      await addFatturaAction(formData);
      setFormKey((k) => k + 1);
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore salvataggio fattura");
    }
  }

  return (
    <div
      className={`${compact ? "bg-white p-1.5" : "h-full min-h-0 overflow-auto bg-white p-1.5"} ${textCls}`}
    >
      <p className={`${compact ? "mb-1" : "mb-2"} font-semibold uppercase`}>
        Fatture insolute
      </p>
      <div className="overflow-x-auto">
        <table
          className={`w-full min-w-[560px] border-collapse ${compact ? "text-[10px]" : ""}`}
        >
          <thead>
            <tr className="border-y border-[#132033] text-left">
              <th className="py-0.5 pr-1">Num.Fatt.</th>
              <th className="py-0.5 pr-1">Causale</th>
              <th className="py-0.5 pr-1">Data Fat.</th>
              <th className="py-0.5 pr-1">Data Scad.</th>
              <th className="py-0.5 pr-1 text-right">Importo</th>
              <th className="py-0.5 pr-1 text-right">Pagato</th>
              <th className="py-0.5 text-right">Saldo</th>
            </tr>
          </thead>
          <tbody>
            {fatture.map((f) => (
              <tr key={f.id}>
                <td className="pr-1 whitespace-nowrap">{f.numero}</td>
                <td className="max-w-[100px] truncate pr-1" title={f.causale || undefined}>
                  {f.causale || "—"}
                </td>
                <td className="pr-1 whitespace-nowrap">{dataIt(f.dataFattura)}</td>
                <td className="pr-1 whitespace-nowrap">{dataIt(f.dataScadenza)}</td>
                <td className="pr-1 text-right whitespace-nowrap">
                  {importoIt(f.importo)}
                </td>
                <td className="pr-1 text-right whitespace-nowrap">
                  {importoIt(f.pagato)}
                </td>
                <td className="text-right whitespace-nowrap">
                  {importoIt(f.importo - f.pagato)}
                </td>
              </tr>
            ))}
            {!fatture.length ? (
              <tr>
                <td colSpan={7} className="py-2 text-[var(--muted)]">
                  Nessuna fattura caricata.
                </td>
              </tr>
            ) : null}
          </tbody>
          {fatture.length ? (
            <tfoot>
              <tr className="border-t border-[#132033] font-semibold">
                <td colSpan={4}>Totali</td>
                <td className="pr-1 text-right">{importoIt(totImp)}</td>
                <td className="pr-1 text-right">{importoIt(totPag)}</td>
                <td className="text-right">{importoIt(totSaldo)}</td>
              </tr>
            </tfoot>
          ) : null}
        </table>
        {scaduto > 0 ? (
          <p className="mt-0.5 text-right">-- Scaduto {importoIt(scaduto)}</p>
        ) : null}
      </div>

      {canEdit ? (
        <form
          key={formKey}
          action={onSubmit}
          className="mt-2 grid grid-cols-2 gap-1 border-t border-[var(--line)] pt-2 sm:grid-cols-3 lg:grid-cols-6"
        >
          <input type="hidden" name="praticaId" value={praticaId} />
          <input
            name="numero"
            required
            placeholder="Num. fattura"
            className={inputCls}
          />
          <input name="causale" placeholder="Causale" className={inputCls} />
          <input
            type="date"
            name="dataFattura"
            required
            title="Data fattura"
            className={inputCls}
          />
          <input
            type="date"
            name="dataScadenza"
            required
            title="Data scadenza"
            className={inputCls}
          />
          <input
            name="importo"
            type="number"
            step="0.01"
            min="0.01"
            required
            placeholder="Importo"
            className={inputCls}
          />
          <input
            name="pagato"
            type="number"
            step="0.01"
            min="0"
            defaultValue={0}
            placeholder="Pagato"
            className={inputCls}
          />
          <button
            type="submit"
            disabled={pending}
            className="col-span-2 h-6 rounded bg-[#132033] px-2 text-[10px] font-semibold text-white disabled:opacity-60 sm:col-span-3 lg:col-span-6"
          >
            {pending ? "Salvataggio…" : "Aggiungi fattura insoluta"}
          </button>
        </form>
      ) : (
        <p className="mt-2 text-[9px] text-[var(--muted)]">
          Solo back office e admin possono caricare le fatture.
        </p>
      )}
      {error ? <p className="mt-1 text-[10px] text-[var(--danger)]">{error}</p> : null}
    </div>
  );
}
