"use client";

import { QUICK_BAR_COMPOUND_FIELD_CLASS } from "@/components/filtri/filtriFieldStyles";

function labelMese(value: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return value;
  const d = new Date(Number(match[1]), Number(match[2]) - 1, 1);
  return d.toLocaleDateString("it-IT", { month: "long", year: "numeric" });
}

/** Mese operatore: tendina con soli mesi che hanno provvigioni (un clic). */
export function ProvvigioniMesePicker({
  value,
  inputKey,
  mesiDisponibili,
}: {
  value: string;
  inputKey?: string;
  mesiDisponibili: string[];
  className?: string;
}) {
  const selezionato =
    mesiDisponibili.includes(value) ? value : mesiDisponibili[0] ?? "";

  if (!mesiDisponibili.length) {
    return (
      <select
        key={inputKey}
        name="mese"
        disabled
        className={`h-10 min-w-[11rem] ${QUICK_BAR_COMPOUND_FIELD_CLASS} px-3 text-sm text-[var(--muted)]`}
      >
        <option value="">Nessun mese con provvigioni</option>
      </select>
    );
  }

  return (
    <select
      key={inputKey}
      name="mese"
      defaultValue={selezionato}
      className={`h-10 min-w-[11rem] ${QUICK_BAR_COMPOUND_FIELD_CLASS} px-3 text-sm`}
    >
      {mesiDisponibili.map((m) => (
        <option key={m} value={m}>
          {labelMese(m)}
        </option>
      ))}
    </select>
  );
}
