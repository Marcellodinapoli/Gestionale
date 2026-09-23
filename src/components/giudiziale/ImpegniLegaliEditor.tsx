"use client";

import type { ImpegnoLegaleExtra } from "@/lib/giudiziale/impegniLegali";
import { newImpegnoLegaleId } from "@/lib/giudiziale/impegniLegali";

const fieldCls =
  "h-9 w-full rounded-lg border border-[#7d94a8] bg-white px-2 text-sm text-[var(--navy)]";
const labelCls = "mb-0.5 block text-[11px] font-semibold text-[var(--danger)]";
const areaCls =
  "w-full rounded-lg border border-[#7d94a8] bg-white px-2 py-1.5 text-sm text-[var(--navy)]";

export function ImpegniLegaliEditor({
  impegni,
  note,
  onChange,
  disabled,
}: {
  impegni: ImpegnoLegaleExtra[];
  note: string;
  onChange: (next: { impegni: ImpegnoLegaleExtra[]; note: string }) => void;
  disabled?: boolean;
}) {
  function patch(index: number, patchRow: Partial<ImpegnoLegaleExtra>) {
    onChange({
      note,
      impegni: impegni.map((row, i) => (i === index ? { ...row, ...patchRow } : row)),
    });
  }

  return (
    <div className="space-y-2">
      <p className={labelCls}>Impegni con data (agenda legale)</p>
      <p className="text-[11px] text-[var(--muted)]">
        Compariranno nel calendario Agenda della sezione Legal.
      </p>
      <div className="space-y-2">
        {impegni.map((row, index) => (
          <div
            key={row.id}
            className="grid gap-2 sm:grid-cols-[1fr_9.5rem_auto] sm:items-end"
          >
            <div>
              <label className={labelCls}>Impegno</label>
              <input
                className={fieldCls}
                value={row.titolo}
                disabled={disabled}
                placeholder="Es. udienza, deposito, appuntamento studio"
                onChange={(e) => patch(index, { titolo: e.target.value })}
              />
            </div>
            <div>
              <label className={labelCls}>Data</label>
              <input
                type="date"
                className={fieldCls}
                value={row.data}
                disabled={disabled}
                onChange={(e) => patch(index, { data: e.target.value })}
              />
            </div>
            <button
              type="button"
              disabled={disabled}
              className="h-9 rounded-lg border border-[var(--line)] px-3 text-xs font-semibold text-[var(--navy)] hover:bg-white disabled:opacity-50"
              onClick={() =>
                onChange({
                  note,
                  impegni: impegni.filter((_, i) => i !== index),
                })
              }
            >
              Rimuovi
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        disabled={disabled}
        className="inline-flex h-9 items-center rounded-lg border border-[var(--line)] bg-white px-3 text-xs font-semibold text-[var(--navy)] hover:bg-[#eef4f8] disabled:opacity-50"
        onClick={() =>
          onChange({
            note,
            impegni: [
              ...impegni,
              { id: newImpegnoLegaleId(), titolo: "", data: "" },
            ],
          })
        }
      >
        Aggiungi impegno
      </button>
      <div>
        <label className={labelCls}>Note agenda</label>
        <textarea
          className={areaCls}
          rows={2}
          value={note}
          disabled={disabled}
          onChange={(e) => onChange({ impegni, note: e.target.value })}
          placeholder="Note libere (non vanno in calendario)"
        />
      </div>
    </div>
  );
}
