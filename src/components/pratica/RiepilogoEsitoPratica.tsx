"use client";

import { codiceScaricoPratica } from "@/lib/scarico";
import { dataIt } from "@/lib/domainFormat";
import { apriNotaF5 } from "@/lib/notaBozza";

function formatDataOra(value?: string | Date | null) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return typeof value === "string" ? value : null;
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function RiepilogoEsitoPratica({
  stato,
  codiceScarico,
  codiceScaricoBk,
  codiceScaricoAt,
  codiceScaricoBkAt,
  promessaAt,
  disabled,
}: {
  stato?: string | null;
  codiceScarico?: string | null;
  /** Codice scarico back office (campo dedicato). */
  codiceScaricoBk?: string | null;
  /** Data/ora modifica codice scarico operatore. */
  codiceScaricoAt?: string | Date | null;
  /** Data/ora modifica codice scarico bk off. */
  codiceScaricoBkAt?: string | Date | null;
  promessaAt?: string | null;
  /** Se true, non apre F5 (pratica bloccata / sola lettura). */
  disabled?: boolean;
}) {
  const codiceOp =
    (codiceScarico || "").trim().toUpperCase() ||
    codiceScaricoPratica(stato || "", codiceScarico) ||
    null;
  const codiceBk = (codiceScaricoBk || "").trim().toUpperCase() || null;
  const quandoOp = formatDataOra(codiceScaricoAt);
  const quandoBk = formatDataOra(codiceScaricoBkAt);
  const parts: string[] = [];
  parts.push(
    quandoOp
      ? `Cod. scarico: ${codiceOp || "—"} (${quandoOp})`
      : `Cod. scarico: ${codiceOp || "—"}`
  );
  if (promessaAt) parts.push(`Promessa: ${dataIt(promessaAt)}`);
  parts.push(
    quandoBk
      ? `Cod. bk off: ${codiceBk || "—"} (${quandoBk})`
      : `Cod. bk off: ${codiceBk || "—"}`
  );

  const label = parts.join(" · ");
  const className =
    "inline-flex h-7 max-w-full shrink-0 items-center rounded border border-[#7eb8c4] bg-[#e8f4f8] px-2 text-left text-[11px] font-medium text-[#1a4a55] sm:whitespace-nowrap disabled:cursor-default disabled:opacity-80 enabled:cursor-pointer enabled:hover:border-[#4a9eb0] enabled:hover:bg-[#d6eef4]";

  return (
    <button
      type="button"
      className={className}
      title={disabled ? label : `${label} · Apri F5 nota / esito`}
      disabled={disabled}
      onClick={() => apriNotaF5()}
    >
      {label}
    </button>
  );
}
