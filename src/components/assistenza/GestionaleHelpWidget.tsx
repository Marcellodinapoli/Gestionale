"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { HelpCircle, Loader2, Send, X } from "lucide-react";
import { callFormazioneFunction } from "@/lib/formazione/callable";
import { assertGestionaleHelpClientPayload } from "@/lib/assistenza/gestionaleHelpPayload";
import { refreshAssistenzaFirebaseSession } from "@/lib/assistenza/refreshAssistenzaSession";
import { AssistenzaProvider, useAssistenza } from "./AssistenzaProvider";
import { getAuth } from "firebase/auth";
import { getApps } from "firebase/app";
import type { SessionUser } from "@/lib/permissions";
import { can } from "@/lib/permissions";

type ChatTurn = { role: "user" | "assistant"; content: string };

type HelpScreenshot = { path: string; caption: string };

type GestionaleHelpResult = {
  answer?: string;
  screenshots?: HelpScreenshot[];
  fromDocumentation?: boolean;
};

function HelpPanel({ onClose }: { onClose: () => void }) {
  const { ready, loading, error, functions, retry, user: fbUser } = useAssistenza();
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [question, setQuestion] = useState("");
  const [pending, setPending] = useState(false);
  const [lastScreenshots, setLastScreenshots] = useState<HelpScreenshot[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [turns, pending]);

  async function submit() {
    const text = question.trim();
    if (!text || pending || !functions || !ready) return;

    setPending(true);
    setSubmitError(null);
    setTurns((prev) => [...prev, { role: "user", content: text }]);
    setQuestion("");
    setLastScreenshots([]);

    try {
      const payload = {
        question: text,
        history: turns.map((t) => ({ role: t.role, content: t.content })),
      };
      assertGestionaleHelpClientPayload(payload);

      const auth = getAuth(getApps()[0]);
      if (!auth.currentUser && !fbUser) {
        throw new Error("Sessione assistenza non pronta");
      }
      await refreshAssistenzaFirebaseSession(auth);

      const data = await callFormazioneFunction<GestionaleHelpResult>(
        functions,
        "gestionaleHelp",
        payload,
      );

      const answer = String(data.answer ?? "").trim();
      if (!answer) throw new Error("empty");

      setLastScreenshots(Array.isArray(data.screenshots) ? data.screenshots : []);
      setTurns((prev) => [...prev, { role: "assistant", content: answer }]);
    } catch {
      setSubmitError("Impossibile ottenere una risposta. Riprova tra poco.");
      setTurns((prev) =>
        prev.at(-1)?.role === "user" ? prev.slice(0, -1) : prev,
      );
      setQuestion(text);
    } finally {
      setPending(false);
    }
  }

  return (
    <div
      className="fixed bottom-4 right-4 z-[90] flex w-[min(100vw-2rem,24rem)] flex-col overflow-hidden rounded-xl border border-[var(--line)] bg-white shadow-2xl print:hidden"
      role="dialog"
      aria-label="Assistenza utilizzo Credixa Suite"
    >
      <header className="flex items-center justify-between gap-2 border-b border-[var(--line)] bg-[#e8eef4] px-3 py-2">
        <div className="flex items-center gap-2">
          <HelpCircle className="h-4 w-4 text-[#1a4f7a]" aria-hidden />
          <h2 className="text-sm font-bold text-[var(--navy)]">Assistenza Credixa Suite</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 text-[var(--muted)] hover:bg-white/80"
          aria-label="Chiudi"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      {loading || !ready ? (
        <div className="flex min-h-[200px] items-center justify-center p-6 text-sm text-[var(--muted)]">
          {error ? (
            <div className="space-y-2 text-center">
              <p>{error}</p>
              <button
                type="button"
                className="text-[#1a4f7a] underline"
                onClick={retry}
              >
                Riprova
              </button>
            </div>
          ) : (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Collegamento…
            </>
          )}
        </div>
      ) : (
        <>
          <div
            ref={scrollRef}
            className="max-h-[min(50vh,320px)] min-h-[160px] space-y-3 overflow-y-auto p-3 text-sm"
          >
            {turns.length === 0 ? (
              <p className="text-[var(--muted)]">
                Chiedi come usare Credixa Suite. Le risposte si basano sui manuali approvati.
              </p>
            ) : null}
            {turns.map((t, i) => (
              <div
                key={i}
                className={
                  t.role === "user"
                    ? "ml-6 rounded-lg bg-[#f0f6fa] px-3 py-2"
                    : "mr-2 rounded-lg border border-[var(--line)] px-3 py-2"
                }
              >
                <p className="whitespace-pre-wrap">{t.content}</p>
              </div>
            ))}
            {lastScreenshots.length > 0 ? (
              <div className="space-y-2 border-t border-[var(--line)] pt-2">
                <p className="text-xs font-semibold text-[var(--muted)]">Schermate</p>
                {lastScreenshots.map((img) => (
                  <figure key={img.path} className="overflow-hidden rounded border border-[var(--line)]">
                    <div className="relative aspect-video w-full bg-[#f5f7fa]">
                      <Image
                        src={img.path}
                        alt={img.caption}
                        fill
                        className="object-contain"
                        sizes="384px"
                        unoptimized
                      />
                    </div>
                    <figcaption className="px-2 py-1 text-xs text-[var(--muted)]">
                      {img.caption}
                    </figcaption>
                  </figure>
                ))}
              </div>
            ) : null}
            {pending ? (
              <p className="flex items-center gap-2 text-[var(--muted)]">
                <Loader2 className="h-4 w-4 animate-spin" />
                Elaborazione…
              </p>
            ) : null}
          </div>

          {submitError ? (
            <p className="px-3 text-xs text-red-700">{submitError}</p>
          ) : null}

          <form
            className="flex gap-2 border-t border-[var(--line)] p-2"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Es. Dove trovo i filtri pratiche?"
              className="min-w-0 flex-1 rounded-lg border border-[var(--line)] px-3 py-2 text-sm"
              maxLength={2000}
              disabled={pending}
            />
            <button
              type="submit"
              disabled={pending || !question.trim()}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#1a4f7a] text-white disabled:opacity-50"
              aria-label="Invia"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </>
      )}
    </div>
  );
}

export function GestionaleHelpWidget({ user }: { user: SessionUser }) {
  const [open, setOpen] = useState(false);

  if (!can(user, "assistenza:view")) return null;

  return (
    <>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-4 right-4 z-[80] flex h-12 w-12 items-center justify-center rounded-full bg-[#1a4f7a] text-white shadow-lg hover:bg-[#153d5c] print:hidden"
          aria-label="Apri assistenza Credixa Suite"
        >
          <HelpCircle className="h-6 w-6" />
        </button>
      ) : (
        <AssistenzaProvider>
          <HelpPanel onClose={() => setOpen(false)} />
        </AssistenzaProvider>
      )}
    </>
  );
}
