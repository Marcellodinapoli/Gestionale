"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Modal } from "@/components/Modal";

/** Apre il corpo di un messaggio senza pratica (segno letto solo con il pulsante dedicato). */
export function ApriMessaggioIndipendente({
  fromName,
  testo,
  createdAtLabel,
}: {
  fromName: string;
  testo: string;
  createdAtLabel: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-1 w-full rounded-md border border-[var(--line)] bg-[#f8fafc] px-2.5 py-2 text-left hover:border-[var(--accent)] hover:bg-[#eef6fb]"
      >
        <p className="line-clamp-3 whitespace-pre-wrap text-sm text-[var(--navy)]">{testo}</p>
        <span className="mt-1.5 inline-block text-xs font-semibold text-[var(--accent)]">
          Apri messaggio
        </span>
      </button>

      <Modal open={open} title={`Messaggio da ${fromName}`} onClose={() => setOpen(false)}>
        <div className="space-y-3 p-4 text-sm">
          <p className="text-xs text-[var(--muted)]">{createdAtLabel}</p>
          <div className="min-h-[80px] whitespace-pre-wrap rounded-lg border border-[var(--line)] bg-white p-3 leading-relaxed">
            {testo}
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg bg-[var(--navy)] px-3 py-1.5 text-sm font-medium text-white"
            >
              Chiudi
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
