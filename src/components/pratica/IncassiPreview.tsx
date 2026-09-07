"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteIncassoAction, updateIncassoAction } from "@/actions/core";
import { dataIt, dateInputValue, importoIt } from "@/lib/domainFormat";
import {
  MODI_INCASSO_PROVV,
  MODO_INCASSO_VERIFICATO,
  normalizeModoIncasso,
} from "@/lib/incassoFattura";
import { METODI_INCASSO, metodoIncassoLabel } from "@/lib/metodoIncasso";
import { invalidatePraticaExtra } from "@/lib/praticaExtraClient";

export type IncassoPreviewRow = {
  id: string;
  data: Date;
  dataScadenza?: Date | null;
  metodo: string;
  modo: string | null;
  importo: number;
  capitale: number;
  interessi: number;
  spese: number;
  causale: string | null;
  fattura?: string | null;
  user?: { name: string } | null;
};

export function IncassiPreview({
  praticaId,
  incassi,
  canEdit,
  fattureInsolute = [],
  compact,
  flow,
}: {
  praticaId?: string;
  incassi: IncassoPreviewRow[];
  canEdit?: boolean;
  fattureInsolute?: Array<{
    id: string;
    numero: string;
    importo: number;
    pagato: number;
  }>;
  compact?: boolean;
  flow?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const tot = incassi.reduce((s, i) => s + i.importo, 0);
  const textCls = compact
    ? "font-mono text-[10px] leading-4 text-[#132033]"
    : "font-mono text-[13px] leading-6 text-[#132033]";
  const inputCls = compact
    ? "h-6 min-w-0 rounded border border-[var(--line)] bg-white px-1 text-[10px] text-[#132033]"
    : "h-8 min-w-0 rounded border border-[var(--line)] bg-white px-2 text-xs text-[#132033]";
  const editable = Boolean(canEdit && praticaId && !flow);
  const editing = editingId ? incassi.find((i) => i.id === editingId) : null;
  const insolite = fattureInsolute.filter((f) => f.importo - f.pagato > 0.009);

  function refreshAfterChange() {
    if (praticaId) invalidatePraticaExtra(praticaId);
    startTransition(() => router.refresh());
  }

  async function onUpdate(formData: FormData) {
    setError(null);
    try {
      await updateIncassoAction(formData);
      setEditingId(null);
      refreshAfterChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Modifica non riuscita");
    }
  }

  async function onDelete(incassoId: string) {
    if (!praticaId) return;
    if (!window.confirm("Eliminare questo incasso registrato?")) return;
    setError(null);
    try {
      const fd = new FormData();
      fd.set("praticaId", praticaId);
      fd.set("incassoId", incassoId);
      await deleteIncassoAction(fd);
      if (editingId === incassoId) setEditingId(null);
      refreshAfterChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Eliminazione non riuscita");
    }
  }

  return (
    <div
      className={`${flow ? "bg-white" : "h-full min-h-0 overflow-y-auto overflow-x-auto bg-white p-1.5"} ${textCls}`}
    >
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
            {editable ? <th className="py-0.5 pl-1 text-right">Azioni</th> : null}
          </tr>
        </thead>
        <tbody>
          {incassi.map((i) => (
            <tr
              key={i.id}
              className={editingId === i.id ? "bg-[#e8f0fa]" : undefined}
            >
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
              {editable ? (
                <td className="whitespace-nowrap pl-1 text-right">
                  <button
                    type="button"
                    disabled={pending}
                    className="mr-1 text-[9px] font-semibold uppercase text-[#1a4f7a] hover:underline disabled:opacity-50"
                    onClick={() => {
                      setError(null);
                      setEditingId((cur) => (cur === i.id ? null : i.id));
                    }}
                  >
                    {editingId === i.id ? "Chiudi" : "Modifica"}
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    className="text-[9px] font-semibold uppercase text-[var(--danger)] hover:underline disabled:opacity-50"
                    onClick={() => void onDelete(i.id)}
                  >
                    Elimina
                  </button>
                </td>
              ) : null}
            </tr>
          ))}
          {!incassi.length ? (
            <tr>
              <td colSpan={editable ? 10 : 9} className="py-2 text-[var(--muted)]">
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
              <td colSpan={editable ? 6 : 5} />
            </tr>
          </tfoot>
        ) : null}
      </table>

      {editable && editing && praticaId ? (
        <form
          key={editing.id}
          action={onUpdate}
          className={`mt-2 grid gap-1 border-t border-[var(--line)] pt-2 ${
            compact ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"
          }`}
        >
          <input type="hidden" name="praticaId" value={praticaId} />
          <input type="hidden" name="incassoId" value={editing.id} />
          <input
            name="importo"
            type="number"
            step="0.01"
            min="0.01"
            required
            defaultValue={editing.importo}
            title="Importo"
            className={inputCls}
          />
          <select name="metodo" defaultValue={editing.metodo || "bonifico"} className={inputCls}>
            {METODI_INCASSO.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
          <select
            name="modo"
            defaultValue={normalizeModoIncasso(editing.modo) || MODO_INCASSO_VERIFICATO}
            className={inputCls}
            title="Esito"
          >
            {MODI_INCASSO_PROVV.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
          <input
            type="date"
            name="data"
            defaultValue={dateInputValue(editing.data)}
            className={inputCls}
          />
          <input
            type="date"
            name="dataScadenza"
            defaultValue={dateInputValue(editing.dataScadenza)}
            className={inputCls}
            title="Data scadenza"
          />
          <select name="fattura" defaultValue={editing.fattura || ""} className={inputCls}>
            <option value="">
              {insolite.length || editing.fattura
                ? "Fattura insoluta…"
                : "Nessuna fattura insoluta"}
            </option>
            {editing.fattura &&
            !insolite.some((f) => f.numero === editing.fattura) ? (
              <option value={editing.fattura}>{editing.fattura}</option>
            ) : null}
            {insolite.map((f) => (
              <option key={f.id} value={f.numero}>
                {f.numero}
              </option>
            ))}
          </select>
          <input
            name="causale"
            defaultValue={editing.causale || ""}
            placeholder="Causale"
            className={`${inputCls} ${compact ? "col-span-2 sm:col-span-3 lg:col-span-5" : "col-span-2 sm:col-span-3 lg:col-span-3"}`}
          />
          <button
            type="submit"
            disabled={pending}
            className={`rounded bg-[#132033] font-semibold text-white disabled:opacity-60 ${
              compact
                ? "col-span-2 h-6 px-2 text-[10px] sm:col-span-3 lg:col-span-6"
                : "col-span-2 h-8 px-3 text-xs sm:col-span-3 lg:col-span-4"
            }`}
          >
            {pending ? "Salvataggio…" : "Salva modifiche"}
          </button>
        </form>
      ) : null}

      {error ? <p className="mt-1 text-[10px] text-[var(--danger)]">{error}</p> : null}
    </div>
  );
}
