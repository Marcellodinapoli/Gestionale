"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { sendMessaggioInternoAction } from "@/actions/core";
import { Modal } from "@/components/Modal";

type Props = {
  fromName: string;
  fromUserId: string;
  testo: string;
  createdAtLabel: string;
  praticaId?: string | null;
  /** Anteprima cliccabile (senza pratica) oppure solo link Rispondi */
  variant?: "preview" | "reply";
};

/** Apre il corpo di un messaggio; risposta al mittente (segno letto solo con il pulsante dedicato). */
export function ApriMessaggioIndipendente({
  fromName,
  fromUserId,
  testo,
  createdAtLabel,
  praticaId,
  variant = "preview",
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [risposta, setRisposta] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function onRispondi(e: FormEvent) {
    e.preventDefault();
    const body = risposta.trim();
    if (!body) {
      setError("Scrivi la risposta");
      return;
    }
    setError(null);
    setSending(true);
    try {
      const fd = new FormData();
      fd.set("toUserId", fromUserId);
      fd.set("collegata", praticaId ? "1" : "0");
      if (praticaId) fd.set("praticaId", praticaId);
      fd.set("testo", body);
      await sendMessaggioInternoAction(fd);
      setRisposta("");
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invio non riuscito");
    } finally {
      setSending(false);
    }
  }

  const modalTitle = variant === "reply" ? `Rispondi a ${fromName}` : `Messaggio da ${fromName}`;

  return (
    <>
      {variant === "preview" ? (
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
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-1 text-xs font-semibold text-[var(--accent)] underline"
        >
          Rispondi
        </button>
      )}

      <Modal open={open} title={modalTitle} onClose={() => setOpen(false)}>
        <form onSubmit={onRispondi} className="space-y-3 p-4 text-sm">
          <p className="text-xs text-[var(--muted)]">{createdAtLabel}</p>
          <div className="min-h-[60px] whitespace-pre-wrap rounded-lg border border-[var(--line)] bg-[#f8fafc] p-3 leading-relaxed text-[var(--navy)]">
            {testo}
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-[var(--muted)]">
              La tua risposta
            </label>
            <textarea
              value={risposta}
              onChange={(e) => setRisposta(e.target.value)}
              rows={4}
              className="w-full rounded-lg border border-[var(--line)] px-3 py-2 text-sm"
              placeholder={`Rispondi a ${fromName}…`}
              disabled={sending}
            />
          </div>
          {error ? <p className="text-xs text-[var(--danger)]">{error}</p> : null}
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-sm"
              disabled={sending}
            >
              Chiudi
            </button>
            <button
              type="submit"
              className="rounded-lg bg-[var(--navy)] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
              disabled={sending}
            >
              {sending ? "Invio…" : "Invia risposta"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
