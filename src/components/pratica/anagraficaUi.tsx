import type { ReactNode } from "react";

export type AnagraficaIndirizzo = {
  indirizzo?: string | null;
  cap?: string | null;
  citta?: string | null;
  provincia?: string | null;
};

export function indirizzoCompleto(d: AnagraficaIndirizzo) {
  const parts = [
    d.indirizzo,
    [d.cap, d.citta, d.provincia].filter(Boolean).join(" "),
  ].filter(Boolean);
  return parts.join(" — ") || "—";
}

export function AnagraficaField({
  label,
  value,
  highlight,
  wide,
  compact,
  accent,
}: {
  label: string;
  value: ReactNode;
  highlight?: boolean;
  wide?: boolean;
  compact?: boolean;
  accent?: boolean;
}) {
  return (
    <div
      className={
        wide
          ? compact
            ? "col-span-full"
            : "col-span-2 sm:col-span-3 lg:col-span-4"
          : ""
      }
    >
      <div
        className={`px-1 py-px text-[9px] font-semibold uppercase tracking-wide ${
          accent
            ? "bg-[#1a4f7a] text-white"
            : "bg-[#eef2f6] text-[#4a5568]"
        }`}
      >
        {label}
      </div>
      <div
        className={`border px-1.5 ${
          accent ? "border-[#1a4f7a]/35 bg-[#f4f9fc]" : "border-[var(--line)] bg-white"
        } ${
          compact ? "min-h-[22px] py-0.5 text-xs leading-snug" : "min-h-[24px] py-0.5 text-sm"
        } ${highlight ? "font-semibold text-[var(--danger)]" : ""} ${
          compact ? "truncate" : ""
        }`}
        title={typeof value === "string" ? value : undefined}
      >
        {value}
      </div>
    </div>
  );
}
