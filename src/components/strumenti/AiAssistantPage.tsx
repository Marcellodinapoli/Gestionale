"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Send, Square } from "lucide-react";
import { useFormazione } from "@/components/formazione/FormazioneProvider";
import { callFormazioneFunction } from "@/lib/formazione/callable";
import { loadAiAssistantPrompt } from "@/lib/strumenti/settingsPrompts";

type ChatTurn = { role: "user" | "assistant"; content: string };

export function AiAssistantPage() {
  const { db, functions } = useFormazione();
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generationRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [turns, loading]);

  // Precarica il prompt in cache senza bloccare la UI
  useEffect(() => {
    if (!db) return;
    void loadAiAssistantPrompt(db);
  }, [db]);

  async function submit() {
    const text = question.trim();
    if (!text || loading || !functions || !db) return;

    const generation = ++generationRef.current;
    setLoading(true);
    setError(null);
    setTurns((prev) => [...prev, { role: "user", content: text }]);
    setQuestion("");

    try {
      const prompt = await loadAiAssistantPrompt(db);
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
          Assistente AI per operatori e supervisor: normativa, negoziazione telefonica,
          obiezioni e best practice operative sul recupero crediti.
        </p>
        <p className="text-[13px] leading-snug text-amber-800">
          Le risposte hanno scopo informativo e non sostituiscono il parere di un
          professionista qualificato.
        </p>
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
