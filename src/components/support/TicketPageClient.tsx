"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, X } from "lucide-react";
import {
  apriTicketAssistenza,
  eliminaTicketAssistenza,
  modificaTicketAssistenza,
  rispondiTicketAssistenza,
} from "@/actions/supportTickets";
import type { SupportMessage, SupportTicket } from "@/lib/support/credixaSupport";

function formatQuando(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("it-IT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

export function TicketPageClient({
  tickets,
  messagesByTicket,
}: {
  tickets: SupportTicket[];
  messagesByTicket: Record<string, SupportMessage[]>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [openForm, setOpenForm] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editSubject, setEditSubject] = useState("");
  const [editMessage, setEditMessage] = useState("");
  const [editFirstMessageId, setEditFirstMessageId] = useState<string | null>(null);
  const [optimisticMsgs, setOptimisticMsgs] = useState<
    Record<string, SupportMessage[]>
  >({});

  // Poll frequente: risposte/chiusure dal Back Office senza F5.
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 5_000);
    return () => window.clearInterval(id);
  }, [router]);

  // Dopo refresh server, scarta optimistic già presenti nei dati reali.
  useEffect(() => {
    setOptimisticMsgs((prev) => {
      let changed = false;
      const next: Record<string, SupportMessage[]> = {};
      for (const [tid, extras] of Object.entries(prev)) {
        const server = messagesByTicket[tid] || [];
        const kept = extras.filter(
          (o) => !server.some((s) => s.text === o.text && s.sender === o.sender)
        );
        if (kept.length) next[tid] = kept;
        if (kept.length !== extras.length) changed = true;
      }
      return changed ? next : prev;
    });
  }, [messagesByTicket]);

  function runAction(fn: () => Promise<void>, fallback: string) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : fallback);
      }
    });
  }

  function submitNew(e: React.FormEvent) {
    e.preventDefault();
    const fd = new FormData();
    fd.set("subject", subject);
    fd.set("message", message);
    runAction(async () => {
      await apriTicketAssistenza(fd);
      setSubject("");
      setMessage("");
      setOpenForm(false);
    }, "Errore invio ticket");
  }

  function submitReply(ticketId: string) {
    const text = (replyDrafts[ticketId] || "").trim();
    if (!text) return;
    const fd = new FormData();
    fd.set("ticketId", ticketId);
    fd.set("message", text);
    const optimistic: SupportMessage = {
      id: `opt-${Date.now()}`,
      text,
      sender: "user",
      timestamp: new Date().toISOString(),
    };
    setOptimisticMsgs((prev) => ({
      ...prev,
      [ticketId]: [...(prev[ticketId] || []), optimistic],
    }));
    setReplyDrafts((prev) => ({ ...prev, [ticketId]: "" }));
    runAction(async () => {
      await rispondiTicketAssistenza(fd);
    }, "Errore risposta");
  }

  function startEdit(t: SupportTicket, msgs: SupportMessage[]) {
    const firstUser = msgs.find((m) => m.sender === "user") || msgs[0];
    setEditingId(t.id);
    setEditSubject(t.subject);
    setEditMessage(firstUser?.text || "");
    setEditFirstMessageId(firstUser?.id || null);
    setError(null);
  }

  function submitEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    const fd = new FormData();
    fd.set("ticketId", editingId);
    fd.set("subject", editSubject);
    fd.set("message", editMessage);
    if (editFirstMessageId) fd.set("firstMessageId", editFirstMessageId);
    runAction(async () => {
      await modificaTicketAssistenza(fd);
      setEditingId(null);
    }, "Errore modifica ticket");
  }

  function confirmDelete(ticketId: string, subjectLabel: string) {
    if (
      !window.confirm(
        `Eliminare definitivamente il ticket «${subjectLabel}»? L'operazione non è annullabile.`
      )
    ) {
      return;
    }
    const fd = new FormData();
    fd.set("ticketId", ticketId);
    runAction(async () => {
      await eliminaTicketAssistenza(fd);
      if (editingId === ticketId) setEditingId(null);
    }, "Errore eliminazione ticket");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-[var(--muted)]">
          Apri un ticket verso l&apos;assistenza Credixa. Le risposte compareanno qui e nel Back
          Office.
        </p>
        <button
          type="button"
          onClick={() => setOpenForm((v) => !v)}
          className="inline-flex h-9 items-center rounded-lg bg-[var(--navy)] px-3 text-sm font-medium text-white hover:opacity-90"
        >
          {openForm ? "Annulla" : "Apri ticket"}
        </button>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {openForm ? (
        <form
          onSubmit={submitNew}
          className="space-y-3 rounded-xl border border-[var(--line)] bg-white p-4"
        >
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Oggetto</label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
              className="w-full rounded-lg border border-[var(--line)] px-3 py-2 text-sm"
              placeholder="Es. Problema accesso operatori"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Messaggio</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
              rows={4}
              className="w-full rounded-lg border border-[var(--line)] px-3 py-2 text-sm"
              placeholder="Descrivi il problema…"
            />
          </div>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-9 items-center rounded-lg bg-[var(--navy)] px-4 text-sm font-medium text-white disabled:opacity-60"
          >
            {pending ? "Invio…" : "Invia ticket"}
          </button>
        </form>
      ) : null}

      {tickets.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--line)] bg-white px-4 py-8 text-center text-sm text-[var(--muted)]">
          Nessun ticket ancora inviato
        </p>
      ) : (
        <ul className="space-y-3">
          {tickets.map((t) => {
            const msgs = [
              ...(messagesByTicket[t.id] || []),
              ...(optimisticMsgs[t.id] || []),
            ];
            const closed = t.status === "closed";
            const isEditing = editingId === t.id;
            return (
              <li
                key={t.id}
                className="rounded-xl border border-[var(--line)] bg-white p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-[var(--navy)]">{t.subject}</h3>
                    <p className="text-xs text-[var(--muted)]">
                      Aperto il {formatQuando(t.createdAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <span
                      className={`rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white ${
                        closed ? "bg-slate-400" : "bg-emerald-600"
                      }`}
                    >
                      {closed ? "Chiuso" : "Aperto"}
                    </span>
                    {!closed ? (
                      <button
                        type="button"
                        title="Modifica"
                        disabled={pending}
                        onClick={() => startEdit(t, msgs)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--line)] text-[var(--navy)] hover:bg-slate-50 disabled:opacity-50"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                    <button
                      type="button"
                      title="Elimina"
                      disabled={pending}
                      onClick={() => confirmDelete(t.id, t.subject)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {isEditing ? (
                  <form
                    onSubmit={submitEdit}
                    className="mt-3 space-y-3 rounded-lg border border-[var(--line)] bg-slate-50 p-3"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-[var(--navy)]">Modifica ticket</p>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="inline-flex h-7 w-7 items-center justify-center rounded text-[var(--muted)] hover:bg-white"
                        title="Chiudi"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[var(--muted)]">
                        Oggetto
                      </label>
                      <input
                        value={editSubject}
                        onChange={(e) => setEditSubject(e.target.value)}
                        required
                        className="w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[var(--muted)]">
                        Messaggio iniziale
                      </label>
                      <textarea
                        value={editMessage}
                        onChange={(e) => setEditMessage(e.target.value)}
                        required
                        rows={3}
                        className="w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="submit"
                        disabled={pending}
                        className="inline-flex h-9 items-center rounded-lg bg-[var(--navy)] px-3 text-sm font-medium text-white disabled:opacity-60"
                      >
                        {pending ? "Salvataggio…" : "Salva"}
                      </button>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => setEditingId(null)}
                        className="inline-flex h-9 items-center rounded-lg border border-[var(--line)] bg-white px-3 text-sm font-medium text-[var(--navy)]"
                      >
                        Annulla
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div className="mt-3 space-y-2">
                      {msgs.map((m) => {
                        const fromAdmin = m.sender === "admin";
                        return (
                          <div
                            key={m.id}
                            className={`rounded-lg border px-3 py-2 text-sm ${
                              fromAdmin
                                ? "border-sky-200 bg-sky-50"
                                : "border-[var(--line)] bg-slate-50"
                            }`}
                          >
                            <p
                              className={`text-xs font-semibold ${
                                fromAdmin ? "text-sky-700" : "text-[var(--muted)]"
                              }`}
                            >
                              {fromAdmin ? "Assistenza" : "Tu"} · {formatQuando(m.timestamp)}
                            </p>
                            <p className="mt-0.5 whitespace-pre-wrap text-[var(--navy)]">
                              {m.text}
                            </p>
                          </div>
                        );
                      })}
                    </div>

                    {!closed ? (
                      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                        <input
                          value={replyDrafts[t.id] || ""}
                          onChange={(e) =>
                            setReplyDrafts((prev) => ({
                              ...prev,
                              [t.id]: e.target.value,
                            }))
                          }
                          placeholder="Scrivi un aggiornamento…"
                          className="min-w-0 flex-1 rounded-lg border border-[var(--line)] px-3 py-2 text-sm"
                        />
                        <button
                          type="button"
                          disabled={pending || !(replyDrafts[t.id] || "").trim()}
                          onClick={() => submitReply(t.id)}
                          className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg border border-[var(--navy)] px-3 text-sm font-medium text-[var(--navy)] hover:bg-slate-50 disabled:opacity-50"
                        >
                          Rispondi
                        </button>
                      </div>
                    ) : null}
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
