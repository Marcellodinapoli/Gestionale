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

export const anagraficaDatiRecapitiGridClassName =
  "grid grid-cols-1 gap-1 sm:grid-cols-2 sm:grid-rows-3 sm:items-stretch sm:gap-x-1 sm:gap-y-0";

type AnagraficaSplitRow = 1 | 2 | 3;
type AnagraficaSplitCol = 1 | 2;

const SPLIT_ROW_CLASS: Record<AnagraficaSplitRow, string> = {
  1: "sm:row-start-1",
  2: "sm:row-start-2",
  3: "sm:row-start-3",
};

const SPLIT_COL_CLASS: Record<AnagraficaSplitCol, string> = {
  1: "sm:col-start-1",
  2: "sm:col-start-2",
};

export function anagraficaSplitCellClass(
  row: AnagraficaSplitRow,
  col: AnagraficaSplitCol
) {
  return `min-w-0 flex h-full min-h-0 flex-col ${SPLIT_ROW_CLASS[row]} ${SPLIT_COL_CLASS[col]}`;
}

export function AnagraficaNomeRiga({ children }: { children: ReactNode }) {
  return (
    <div className={anagraficaSplitCellClass(1, 1)}>
      <p className="flex min-h-[20px] flex-1 items-center border border-[var(--line)] bg-white px-1.5 py-0.5 text-xs font-semibold uppercase">
        {children}
      </p>
    </div>
  );
}

export function AnagraficaField({
  label,
  value,
  highlight,
  wide,
  compact,
  accent,
  tone,
  stretch,
}: {
  label: string;
  value: ReactNode;
  highlight?: boolean;
  wide?: boolean;
  compact?: boolean;
  accent?: boolean;
  /** Colore valore stile CG32 (Pagato verde / Da pagare rosso). */
  tone?: "default" | "success" | "danger";
  /** Riempie la cella nel layout dati | recapiti a righe. */
  stretch?: boolean;
}) {
  return (
    <div
      className={`${
        wide
          ? compact
            ? "col-span-full"
            : "col-span-2 sm:col-span-3 lg:col-span-4"
          : ""
      }${stretch ? " flex h-full min-h-0 flex-col" : ""}`}
    >
      <div
        className={`px-0.5 py-px text-[9px] font-semibold uppercase leading-tight tracking-wide ${
          accent
            ? "bg-[#1a4f7a] text-right text-white"
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
            ? `min-h-[20px] px-0.5 py-px text-[11px] leading-snug${stretch ? " flex flex-1 items-center" : ""}`
            : "min-h-[24px] px-1.5 py-0.5 text-sm"
        } ${
          tone === "success"
            ? "font-semibold text-emerald-700"
            : tone === "danger" || highlight
              ? "font-semibold text-[var(--danger)]"
              : ""
        } ${compact ? "truncate" : ""} ${accent ? "text-right" : ""}`}
        title={typeof value === "string" ? value : undefined}
      >
        {value}
      </div>
    </div>
  );
}
