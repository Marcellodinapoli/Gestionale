"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Loader2, Send, Square } from "lucide-react";
import { useFormazione } from "@/components/formazione/FormazioneProvider";
import { callFormazioneFunction } from "@/lib/formazione/callable";
import { loadNormativePrompt } from "@/lib/strumenti/settingsPrompts";
import {
  formatLogDate,
  loadMyNormativeSearchLogsOnce,
  type NormativeSearchLogEntry,
} from "@/lib/strumenti/normativeSearchLog";

type ChatTurn = { role: "user" | "assistant"; content: string };

function NormativeSearchHistory({
  onSelectQuestion,
}: {
  onSelectQuestion: (question: string) => void;
}) {
  const { db, user } = useFormazione();
  const [entries, setEntries] = useState<NormativeSearchLogEntry[]>([]);
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    if (!open || loaded || !db || !user) return;
    let cancelled = false;
    setLoadingHistory(true);
    void loadMyNormativeSearchLogsOnce(db, user.uid).then((rows) => {
      if (cancelled) return;
      setEntries(rows);
      setLoaded(true);
      setLoadingHistory(false);
    });
    return () => {
      cancelled = true;
    };
  }, [open, loaded, db, user]);

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left"
      >
        <div>
          <p className="text-sm font-semibold text-[var(--navy)]">
            Le tue ricerche precedenti
            {loaded ? ` (${entries.length})` : ""}
          </p>
          <p className="mt-1 text-xs leading-snug text-[var(--muted)]">
            Rivedi le risposte già ottenute ed evita domande duplicate.
          </p>
        </div>
        <ChevronDown
          className={`mt-0.5 h-4 w-4 shrink-0 text-black/45 transition ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open ? (
        <div className="max-h-64 overflow-y-auto border-t border-[var(--line)] px-4 py-2">
          {loadingHistory ? (
            <p className="py-3 text-sm text-[var(--muted)]">Caricamento cronologia…</p>
          ) : !entries.length ? (
            <p className="py-3 text-sm text-[var(--muted)]">Nessuna ricerca precedente.</p>
          ) : (
            entries.map((entry) => (
              <HistoryItem
                key={entry.id}
                entry={entry}
                onSelectQuestion={onSelectQuestion}
              />
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

function HistoryItem({
  entry,
  onSelectQuestion,
}: {
  entry: NormativeSearchLogEntry;
  onSelectQuestion: (q: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const answer =
    entry.answer.trim() || entry.answerPreview.trim() || "Nessuna risposta salvata.";

  return (
    <div className="border-b border-[var(--line)] py-3 last:border-b-0">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-start justify-between gap-2 text-left"
      >
        <span className="line-clamp-2 text-sm font-semibold text-[var(--navy)]">
          {entry.question}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-black/45 transition ${expanded ? "rotate-180" : ""}`}
        />
      </button>
      <p className="mt-1 text-xs text-[var(--muted)]">{formatLogDate(entry.createdAt)}</p>
      {expanded ? (
        <>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-black/80">
            {answer}
          </p>
          <button
            type="button"
            onClick={() => onSelectQuestion(entry.question)}
            className="mt-2 text-sm font-semibold text-[#1565C0] hover:underline"
          >
            Usa di nuovo questa domanda
          </button>
        </>
      ) : entry.answerPreview.trim() ? (
        <p className="mt-1 line-clamp-2 text-xs leading-snug text-black/65">
          {entry.answerPreview}
        </p>
      ) : null}
    </div>
  );
}

export function NormativeSearchPage() {
  const { db, functions } = useFormazione();
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generationRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Precarica il prompt in cache senza bloccare la UI
  useEffect(() => {
    if (!db) return;
    void loadNormativePrompt(db);
  }, [db]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [turns, loading]);

  async function submit() {
    const text = question.trim();
    if (!text || loading || !functions || !db) return;

    const generation = ++generationRef.current;
    setLoading(true);
    setError(null);
    setTurns((prev) => [...prev, { role: "user", content: text }]);
    setQuestion("");

    try {
      const prompt = await loadNormativePrompt(db);
      if (generation !== generationRef.current) return;

      const history = turns.map((t) => ({ role: t.role, content: t.content }));
      const data = await callFormazioneFunction<{ answer?: string }>(
        functions,
        "normativeSearch",
        { question: text, prompt, history }
      );

      if (generation !== generationRef.current) return;
      const answer = String(data.answer ?? "").trim();
      if (!answer) throw new Error("empty");

      setTurns((prev) => [...prev, { role: "assistant", content: answer }]);
    } catch {
      if (generation !== generationRef.current) return;
      setError("Impossibile ottenere una risposta. Riprova tra poco.");
      setTurns((prev) => (prev.at(-1)?.role === "user" ? prev.slice(0, -1) : prev));
      setQuestion(text);
    } finally {
      if (generation === generationRef.current) setLoading(false);
    }
  }

  function stopSearch() {
    if (!loading) return;
    generationRef.current++;
    setLoading(false);
    setError(null);
    setTurns((prev) => {
      if (prev.at(-1)?.role !== "user") return prev;
      const last = prev.at(-1)!.content;
      if (!question.trim()) setQuestion(last);
      return prev.slice(0, -1);
    });
  }

  return (
    <div className="flex min-h-[calc(100vh-220px)] flex-col rounded-xl border border-[var(--line)] bg-white shadow-sm">
      <div className="space-y-2 border-b border-[var(--line)] px-4 py-4 sm:px-6">
        <p className="text-sm leading-relaxed text-black/70">
          Scrivi una domanda sull&apos;attività stragiudiziale, in particolare sul recupero
          crediti. L&apos;assistente risponde in linguaggio semplice.
        </p>
        <p className="text-[13px] leading-snug text-amber-800">
          Le risposte hanno scopo informativo e non sostituiscono il parere di un
          professionista qualificato.
        </p>
        <NormativeSearchHistory onSelectQuestion={setQuestion} />
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
        {!turns.length ? (
          <p className="py-12 text-center text-sm text-black/55">
            Scrivi la prima domanda nel campo in basso per iniziare.
          </p>
        ) : (
          <div className="space-y-3">
            {turns.map((turn, index) => {
              const isUser = turn.role === "user";
              return (
                <div
                  key={`${turn.role}-${index}`}
                  className={`max-w-[85%] rounded-xl border px-4 py-3 text-sm leading-relaxed ${
                    isUser
                      ? "ml-auto border-[#00B0FF]/35 bg-[#00B0FF]/10"
                      : "mr-auto border-[#E0E0E0] bg-[#F5F5F5]"
                  }`}
                >
                  {turn.content}
                </div>
              );
            })}
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-black/55">
                <Loader2 className="h-4 w-4 animate-spin" />
                Analisi in corso…
              </div>
            ) : null}
          </div>
        )}
      </div>

      <div className="border-t border-[var(--line)] px-4 py-4 sm:px-6">
        <div className="flex items-end gap-2">
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void submit();
              }
            }}
            rows={2}
            placeholder="Scrivi la tua domanda…"
            className="min-h-[44px] flex-1 resize-y rounded-lg border border-[var(--line)] px-3 py-2 text-sm focus:border-[#1a4f7a] focus:outline-none focus:ring-2 focus:ring-[#1a4f7a]/15"
          />
          {loading ? (
            <button
              type="button"
              onClick={stopSearch}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-gray-800 text-white"
              aria-label="Interrompi"
            >
              <Square className="h-4 w-4" />
            </button>
          ) : null}
          <button
            type="button"
            disabled={loading || !question.trim()}
            onClick={() => void submit()}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#00B0FF] text-white disabled:opacity-50"
            aria-label="Invia"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
