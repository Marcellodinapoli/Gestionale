"use client";

import { useRef, useState } from "react";
import { Mic, X } from "lucide-react";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { useFormazione } from "@/components/formazione/FormazioneProvider";
import { callFormazioneFunction } from "@/lib/formazione/callable";
import { categoryColor } from "@/lib/formazione/warmupDefaults";
import type { ContestazioneTrainingItem } from "@/lib/formazione/contestazioniDefaults";

const STEP_TITLES = [
  "1️⃣ Contestazione dichiarata",
  "2️⃣ Cosa sta comunicando davvero",
  "3️⃣ Rischio se gestita male",
  "4️⃣ Obiettivo dell'operatore",
  "5️⃣ Linea di risposta corretta",
  "6️⃣ Simulazione attiva",
];

export function ContestationTrainingModal({
  item,
  onClose,
  onComplete,
}: {
  item: ContestazioneTrainingItem;
  onClose: () => void;
  onComplete: () => void;
}) {
  const { db, user, functions } = useFormazione();
  const [step, setStep] = useState(0);
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [hasRecording, setHasRecording] = useState(false);
  const [aiResult, setAiResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const color = categoryColor(item.category);

  async function toggleRecording() {
    if (recording) {
      mediaRef.current?.stop();
      setRecording(false);
      return;
    }

    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        if (blob.size < 5000) {
          setError("Registrazione troppo breve, riprova.");
          return;
        }
        await evaluate(blob);
      };
      mediaRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      setError("Microfono non disponibile o permesso negato.");
    }
  }

  async function evaluate(blob: Blob) {
    if (!functions || !db || !user) return;
    setProcessing(true);
    setHasRecording(true);
    setAiResult(null);
    setError(null);

    try {
      const buffer = await blob.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = "";
      bytes.forEach((b) => {
        binary += String.fromCharCode(b);
      });

      const result = await callFormazioneFunction<Record<string, unknown>>(
        functions,
        "warmupEvaluate",
        {
          audioBase64: btoa(binary),
          mimeType: "audio/webm",
          phase: item.title,
          expectedText: item.response,
          phaseExplanation: `Contestazione: ${item.declared}\nSignificato: ${item.meaning}\nRischio: ${item.risk}\nObiettivo: ${item.objective}`,
          customerLine: item.declared,
          kind: "contestation",
          systemPrompt: item.systemPrompt,
        }
      );

      setAiResult(result);

      const transcription = String(result.trascrizione ?? "").trim();
      await setDoc(
        doc(db, "listening_progress", user.uid),
        {
          uid: user.uid,
          contestazioneResponses: transcription
            ? { [item.title]: transcription }
            : {},
          contestazioneEvaluations: {
            [item.title]: {
              result,
              evaluatedAtMs: Date.now(),
            },
          },
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Valutazione non riuscita");
    } finally {
      setProcessing(false);
    }
  }

  const transcription = String(aiResult?.trascrizione ?? "").trim();
  const commento = String(aiResult?.commento ?? "").trim();
  const versione = String(aiResult?.versione_migliorata ?? "").trim();
  const canFinish = hasRecording;

  function stepContent() {
    switch (step) {
      case 0:
        return <p className="text-base leading-relaxed">{item.declared}</p>;
      case 1:
        return <p className="text-base leading-relaxed">{item.meaning}</p>;
      case 2:
        return <p className="text-base leading-relaxed">{item.risk}</p>;
      case 3:
        return <p className="text-base leading-relaxed">{item.objective}</p>;
      case 4:
        return <p className="text-base leading-relaxed">{item.response}</p>;
      case 5:
        return (
          <div className="space-y-4">
            <p className="text-base font-semibold">Rispondi con la tua voce.</p>
            {item.response.trim() ? (
              <div>
                <p className="mb-2 text-sm font-semibold text-[var(--muted)]">
                  Linea di risposta corretta (riferimento)
                </p>
                <div className="rounded-xl bg-[#F3F4F6] px-4 py-3 text-sm">
                  {item.response}
                </div>
              </div>
            ) : null}
            <div className="flex flex-col items-center gap-2 py-2">
              <button
                type="button"
                onClick={() => void toggleRecording()}
                disabled={processing}
                className="rounded-full p-4 transition hover:bg-black/5 disabled:opacity-50"
              >
                <Mic
                  className="h-12 w-12"
                  style={{ color: recording ? "#DC2626" : color }}
                />
              </button>
              <p className="max-w-md text-center text-xs text-black/55">
                La registrazione non viene salvata né ascoltata da nessuno. Puoi
                riascoltarla solo ora, durante questa simulazione.
              </p>
            </div>
            <div className="rounded-xl border border-[var(--line)] bg-[#FAFAFA] px-4 py-4 text-sm leading-relaxed">
              {processing
                ? "Trascrizione in corso…"
                : transcription
                  ? `«${transcription}»`
                  : "La tua risposta vocale apparirà qui dopo la registrazione."}
            </div>
            {aiResult ? (
              <div className="space-y-3">
                <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm">
                  <p className="font-bold text-blue-900">Suggerimento AI</p>
                  {commento ? <p className="mt-2 leading-relaxed">{commento}</p> : null}
                  {versione ? (
                    <p className="mt-2 leading-relaxed">
                      <span className="font-medium">Esempio di risposta:</span> {versione}
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}
            {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
          </div>
        );
      default:
        return null;
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4">
      <div className="flex max-h-[95vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
        <div
          className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3"
          style={{ borderTop: `4px solid ${color}` }}
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              Contestazione
            </p>
            <h3 className="text-lg font-bold text-[var(--navy)]">{item.title}</h3>
            {item.subtitle ? (
              <p className="text-sm text-[var(--muted)]">{item.subtitle}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-[var(--muted)] hover:bg-[#F3F4F6]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-4 pt-3">
          <div className="flex gap-1.5">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="h-1.5 flex-1 rounded-full"
                style={{ backgroundColor: i <= step ? color : "#E5E7EB" }}
              />
            ))}
          </div>
          <p className="mt-3 text-sm font-semibold text-[var(--navy)]">
            {STEP_TITLES[step]}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">{stepContent()}</div>

        <div className="flex items-center justify-between gap-3 border-t border-[var(--line)] px-4 py-3">
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className="rounded-lg border border-[var(--line)] px-4 py-2 text-sm font-semibold disabled:opacity-40"
          >
            Indietro
          </button>
          {step < 5 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-white"
              style={{ backgroundColor: color }}
            >
              Avanti
            </button>
          ) : (
            <button
              type="button"
              disabled={!canFinish}
              onClick={async () => {
                if (!db || !user) return;
                await setDoc(
                  doc(db, "listening_progress", user.uid),
                  {
                    contestazioni: { [item.id]: true },
                    updatedAt: serverTimestamp(),
                  },
                  { merge: true }
                );
                onComplete();
                onClose();
              }}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
            >
              Completa
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
