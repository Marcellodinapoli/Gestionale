"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Modal } from "@/components/Modal";
import {
  deleteMessaggioInternoAction,
  updateMessaggioInternoAction,
} from "@/actions/core";

export function GestisciMessaggioInviato({
  messageId,
  testoIniziale,
}: {
  messageId: string;
  testoIniziale: string;
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [testo, setTesto] = useState(testoIniziale);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function salva() {
    const trimmed = testo.trim();
    if (!trimmed) {
      setError("Scrivi il messaggio");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("messageId", messageId);
      fd.set("testo", trimmed);
      await updateMessaggioInternoAction(fd);
      setEditOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Modifica non riuscita");
    } finally {
      setPending(false);
    }
  }

  async function elimina() {
    if (!window.confirm("Eliminare questo messaggio inviato?")) return;
    setPending(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("messageId", messageId);
      await deleteMessaggioInternoAction(fd);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Eliminazione non riuscita");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <div className="flex flex-col items-end gap-1.5">
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setTesto(testoIniziale);
            setError(null);
            setEditOpen(true);
          }}
          className="rounded border border-[var(--line)] bg-white px-2 py-1 text-xs hover:bg-[#eef4f8] disabled:opacity-60"
        >
          Modifica
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => void elimina()}
          className="rounded border border-red-200 bg-white px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-60"
        >
          Elimina
        </button>
        {error && !editOpen ? (
          <p className="max-w-[10rem] text-right text-[11px] text-[var(--danger)]">{error}</p>
        ) : null}
      </div>

      <Modal
        open={editOpen}
        title="Modifica messaggio inviato"
        onClose={() => !pending && setEditOpen(false)}
      >
        <div className="space-y-3 p-4">
          <textarea
            value={testo}
            onChange={(e) => setTesto(e.target.value)}
            rows={6}
            className="w-full rounded-lg border border-[var(--line)] px-3 py-2 text-sm"
            disabled={pending}
          />
          {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
          <p className="text-xs text-[var(--muted)]">
            Dopo la modifica il messaggio tornerà “da leggere” per il destinatario.
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => setEditOpen(false)}
              className="rounded-lg border border-[var(--line)] bg-white px-3 py-1.5 text-sm"
            >
              Annulla
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => void salva()}
              className="rounded-lg bg-[var(--navy)] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
            >
              {pending ? "…" : "Salva"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
