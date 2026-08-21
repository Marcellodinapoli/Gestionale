"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare } from "lucide-react";
import { sendMessaggioInternoAction } from "@/actions/core";

export function InviaMessaggioRapido({
  toUserId,
  toUserName,
}: {
  toUserId: string;
  toUserName: string;
}) {
  const router = useRouter();
  const [aperto, setAperto] = useState(false);
  const [testo, setTesto] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(null);
    setSending(true);
    try {
      const fd = new FormData();
      fd.set("collegata", "0");
      fd.set("toUserId", toUserId);
      fd.set("testo", testo);
      await sendMessaggioInternoAction(fd);
      setTesto("");
      setOk(`Inviato a ${toUserName}`);
      setAperto(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invio non riuscito");
    } finally {
      setSending(false);
    }
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
      <button
        type="button"
        onClick={() => {
          setAperto((v) => !v);
          setError(null);
          setOk(null);
        }}
        className="inline-flex items-center gap-1 text-xs font-medium text-[var(--accent)] underline hover:text-[var(--navy)]"
        title={`Invia messaggio a ${toUserName}`}
      >
        <MessageSquare className="h-3.5 w-3.5" aria-hidden />
        Messaggio
      </button>
      {ok ? <span className="text-xs text-emerald-700">{ok}</span> : null}
      {aperto ? (
        <form
          onSubmit={onSubmit}
          className="mt-1 flex w-full basis-full flex-wrap items-center gap-2"
        >
          <input
            value={testo}
            onChange={(e) => setTesto(e.target.value)}
            placeholder={`Scrivi a ${toUserName}…`}
            className="h-8 min-w-[12rem] flex-1 rounded border border-[var(--line)] bg-white px-2 text-sm"
            autoFocus
          />
          <button
            type="submit"
            disabled={sending || !testo.trim()}
            className="h-8 rounded bg-[var(--navy)] px-3 text-xs font-medium text-white disabled:opacity-60"
          >
            {sending ? "…" : "Invia"}
          </button>
          <button
            type="button"
            onClick={() => setAperto(false)}
            className="h-8 rounded border border-[var(--line)] bg-white px-2 text-xs"
          >
            Annulla
          </button>
          {error ? <p className="w-full text-xs text-[var(--danger)]">{error}</p> : null}
        </form>
      ) : null}
    </span>
  );
}
