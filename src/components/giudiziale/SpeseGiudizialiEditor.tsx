"use client";

import {
  TIPOLOGIE_SPESA_GIUDIZIALE,
  emptySpesaGiudizialeVoce,
  totaleSpeseGiudiziali,
  type SpesaGiudizialeVoce,
} from "@/lib/giudiziale/speseGiudiziali";
import { importoIt } from "@/lib/domainFormat";

const fieldCls =
  "h-9 w-full rounded-lg border border-[#7d94a8] bg-white px-2 text-sm text-[var(--navy)]";
const labelCls = "mb-0.5 block text-[11px] font-semibold text-[var(--danger)]";

export function SpeseGiudizialiEditor({
  voci,
  onChange,
  disabled,
}: {
  voci: SpesaGiudizialeVoce[];
  onChange: (next: SpesaGiudizialeVoce[]) => void;
  disabled?: boolean;
}) {
  const totale = totaleSpeseGiudiziali(voci);
  const attive = voci.filter((v) => !v.annullata);
  const annullate = voci.filter((v) => v.annullata);

  function patch(id: string, patch: Partial<SpesaGiudizialeVoce>) {
    onChange(voci.map((v) => (v.id === id ? { ...v, ...patch } : v)));
  }

  function addVoce() {
    onChange([...voci, emptySpesaGiudizialeVoce()]);
  }

  function annulla(id: string) {
    onChange(
      voci.map((v) => (v.id === id ? { ...v, annullata: true } : v))
    );
  }

  function ripristina(id: string) {
    onChange(
      voci.map((v) => (v.id === id ? { ...v, annullata: false } : v))
    );
  }

  return (
    <section className="space-y-3 rounded-lg border border-[var(--line)]/70 bg-[#f8fafc] p-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-[var(--navy)]">
            Spese giudiziali
          </h3>
          <p className="text-[11px] text-[var(--muted)]">
            Dettaglio solo in Legal. Il totale aggiorna automaticamente la pratica
            del debitore.
          </p>
        </div>
        <p className="text-sm font-bold tabular-nums text-[var(--navy)]">
          Totale spese giudiziali: € {importoIt(totale)}
        </p>
      </div>

      {attive.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">
          Nessuna spesa registrata. Aggiungi le voci di costo della procedura.
        </p>
      ) : (
        <div className="space-y-3">
          {attive.map((v, idx) => (
            <div
              key={v.id}
              className="grid gap-2 rounded-md border border-[var(--line)] bg-white p-2 sm:grid-cols-2 lg:grid-cols-6"
            >
              <div className="lg:col-span-6">
                <span className="text-[11px] font-semibold uppercase text-[var(--muted)]">
                  Spesa {idx + 1}
                </span>
              </div>
              <div>
                <label className={labelCls}>Data</label>
                <input
                  type="date"
                  className={fieldCls}
                  value={v.data}
                  disabled={disabled}
                  onChange={(e) => patch(v.id, { data: e.target.value })}
                />
              </div>
              <div>
                <label className={labelCls}>Tipologia</label>
                <select
                  className={fieldCls}
                  value={v.tipologia}
                  disabled={disabled}
                  onChange={(e) => patch(v.id, { tipologia: e.target.value })}
                >
                  {TIPOLOGIE_SPESA_GIUDIZIALE.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2 lg:col-span-2">
                <label className={labelCls}>Descrizione</label>
                <input
                  className={fieldCls}
                  value={v.descrizione}
                  disabled={disabled}
                  onChange={(e) => patch(v.id, { descrizione: e.target.value })}
                  placeholder="Es. contributo unificato, notifica atto…"
                />
              </div>
              <div>
                <label className={labelCls}>Importo €</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className={fieldCls}
                  value={v.importo || ""}
                  disabled={disabled}
                  onChange={(e) =>
                    patch(v.id, {
                      importo: e.target.value === "" ? 0 : Number(e.target.value),
                    })
                  }
                />
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => annulla(v.id)}
                  className="h-9 rounded-lg border border-[var(--line)] px-3 text-xs font-semibold text-[var(--danger)] hover:bg-[#fef2f2] disabled:opacity-50"
                >
                  Annulla
                </button>
              </div>
              <div className="sm:col-span-2 lg:col-span-6">
                <label className={labelCls}>Note</label>
                <input
                  className={fieldCls}
                  value={v.note}
                  disabled={disabled}
                  onChange={(e) => patch(v.id, { note: e.target.value })}
                  placeholder="Informazioni aggiuntive"
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {!disabled ? (
        <button
          type="button"
          onClick={addVoce}
          className="inline-flex h-9 items-center rounded-lg bg-[var(--navy)] px-3 text-sm font-semibold text-white hover:opacity-90"
        >
          Aggiungi spesa
        </button>
      ) : null}

      {annullate.length > 0 ? (
        <div className="space-y-2 border-t border-[var(--line)] pt-3">
          <p className="text-[11px] font-semibold uppercase text-[var(--muted)]">
            Spese annullate (storico Legal)
          </p>
          {annullate.map((v) => (
            <div
              key={v.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-[#f1f5f9] px-2 py-1.5 text-sm text-[var(--muted)] line-through"
            >
              <span>
                {v.descrizione || labelTipologiaFallback(v.tipologia)} · €{" "}
                {importoIt(v.importo)}
              </span>
              {!disabled ? (
                <button
                  type="button"
                  onClick={() => ripristina(v.id)}
                  className="text-xs font-semibold text-[var(--navy)] no-underline hover:underline"
                >
                  Ripristina
                </button>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function labelTipologiaFallback(value: string) {
  return (
    TIPOLOGIE_SPESA_GIUDIZIALE.find((t) => t.value === value)?.label || value
  );
}
