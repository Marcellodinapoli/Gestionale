"use client";

import Link from "next/link";
import { useEscBack } from "@/lib/useEscBack";

export function PraticaContabileShell({
  praticaId,
  numero,
  debitore,
  embed,
  children,
}: {
  praticaId: string;
  numero: string;
  debitore: string;
  attivo?: "fatture" | "estratto" | "incassi";
  embed?: boolean;
  canEditNotes?: boolean;
  esitoContatto?: string | null;
  tipoContatto?: string | null;
  memoAt?: string | null;
  promessaAt?: string | null;
  children: React.ReactNode;
}) {
  const backHref = `/pratiche/${praticaId}`;
  useEscBack(backHref, !embed);

  if (embed) {
    return <div className="rounded-lg border border-[var(--line)] bg-white p-3">{children}</div>;
  }

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-lg border border-[var(--line)] bg-[#f5f7fa] shadow-sm">
      <div className="flex shrink-0 flex-wrap items-center gap-1.5 truncate border-b border-[var(--line)] bg-[#dce4ec] px-3 py-1.5 text-sm text-[var(--navy)]">
        <Link
          href={backHref}
          className="shrink-0 text-xs font-medium underline-offset-2 hover:underline"
        >
          ← Pratica
        </Link>
        <span className="shrink-0 text-[var(--muted)]">·</span>
        <span className="truncate font-bold">{debitore}</span>
        <span className="shrink-0 text-[var(--muted)]">·</span>
        <span className="shrink-0 font-mono text-xs text-[var(--muted)]">{numero}</span>
        <span className="ml-auto hidden shrink-0 text-[10px] text-[var(--muted)] sm:inline">
          Esc · torna alla pratica
        </span>
      </div>
      <div className="min-h-0 overflow-auto bg-white p-3">{children}</div>
    </div>
  );
}
