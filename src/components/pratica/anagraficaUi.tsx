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
  tone,
}: {
  label: string;
  value: ReactNode;
  highlight?: boolean;
  wide?: boolean;
  compact?: boolean;
  accent?: boolean;
  /** Colore valore stile CG32 (Pagato verde / Da pagare rosso). */
  tone?: "default" | "success" | "danger";
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
        className={`px-0.5 py-px text-[9px] font-semibold uppercase leading-tight tracking-wide ${
          accent
            ? "bg-[#1a4f7a] text-white"
            : "bg-[#eef2f6] text-[#4a5568]"
        }`}
      >
        {label}
      </div>
      <div
        className={`border ${
          accent ? "border-[#1a4f7a]/35 bg-[#f4f9fc]" : "border-[var(--line)] bg-white"
        } ${
          compact
            ? "min-h-[20px] px-0.5 py-px text-[11px] leading-snug"
            : "min-h-[24px] px-1.5 py-0.5 text-sm"
        } ${
          tone === "success"
            ? "font-semibold text-emerald-700"
            : tone === "danger" || highlight
              ? "font-semibold text-[var(--danger)]"
              : ""
        } ${compact ? "truncate" : ""}`}
        title={typeof value === "string" ? value : undefined}
      >
        {value}
      </div>
    </div>
  );
}
