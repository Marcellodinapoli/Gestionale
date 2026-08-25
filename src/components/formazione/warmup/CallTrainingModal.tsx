"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Mic, X } from "lucide-react";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { useFormazione } from "@/components/formazione/FormazioneProvider";
import { callFormazioneFunction } from "@/lib/formazione/callable";
import {
  colorFromValue,
  defaultPhase,
  resolvePhases,
  type WarmupTelefonataPhase,
} from "@/lib/formazione/warmupDefaults";

const MIN_SCORE = 70;
const MAX_ATTEMPTS = 3;

function extractScore(result: Record<string, unknown> | null) {
  if (!result) return 0;
  const score = result.score;
  if (typeof score === "number") return Math.round(score);
  if (typeof score === "string") return Number.parseInt(score, 10) || 0;
  return 0;
}

function phasePassed(result: Record<string, unknown> | null) {
  if (!result) return false;
  if (typeof result.puo_proseguire === "boolean") return result.puo_proseguire;
  return extractScore(result) >= MIN_SCORE;
}

function customerLineIntro(phaseKey: string) {
  switch (phaseKey) {
    case "Presentazione_standard":
      return "Il debitore continua così la conversazione:";
    case "Motivo_della_chiamata":
    case "Negoziazione":
    case "Chiusura":
      return "Il debitore risponde così:";
    case "Approccio":
      return "L'interlocutore apre così la conversazione:";
    case "Presentazione_privacy":
      return "L'interlocutore risponde così:";
    default:
      return "L'interlocutore continua così la conversazione:";
  }
}

function step0Label(phaseKey: string) {
  switch (phaseKey) {
    case "Presentazione_standard":
    case "Motivo_della_chiamata":
    case "Negoziazione":
    case "Chiusura":
      return "Risposta del debitore";
    case "Approccio":
    case "Presentazione_privacy":
      return "Risposta dell'interlocutore";
    default:
      return "Risposta del cliente";
  }
}

export function CallTrainingModal({
  phaseKey,
  onClose,
  onComplete,
}: {
  phaseKey: string;
  onClose: () => void;
  onComplete: () => void;
}) {
  const { db, user, functions } = useFormazione();
  const [phase, setPhase] = useState<WarmupTelefonataPhase>(() =>
    defaultPhase(phaseKey)
  );
  const [step, setStep] = useState(0);
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [hasRecorded, setHasRecorded] = useState(false);
  const [attemptCount, setAttemptCount] = useState(0);
  const [aiResult, setAiResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const color = useMemo(() => colorFromValue(phase.colorValue), [phase.colorValue]);

  useEffect(() => {
    if (!db) return;
    void getDoc(doc(db, "settings", "warmup_telefonata")).then((snap) => {
      const raw = snap.data()?.phases;
      const map =
        raw && typeof raw === "object"
          ? (raw as Record<string, Record<string, unknown>>)
          : null;
      const phases = resolvePhases(map);
      setPhase(phases[phaseKey] ?? defaultPhase(phaseKey));
    });
  }, [db, phaseKey]);

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
    setHasRecorded(true);
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
          phase: phase.sectionTitle,
          expectedText: phase.evaluationCriteria,
          phaseExplanation: `Risposta del cliente: ${phase.customerLine}\n${phase.spiegazione}`,
          customerLine: phase.customerLine,
          kind: "warmup",
          systemPrompt: phase.systemPrompt,
          phaseInstruction: phase.phaseInstruction,
        }
      );

      const score = extractScore(result);
      const passed = phasePassed(result);
      if (!passed && attemptCount < MAX_ATTEMPTS) {
        setAttemptCount((n) => n + 1);
      }

      setAiResult(result);

      const transcription = String(result.trascrizione ?? "").trim();
      if (transcription) {
        await setDoc(
          doc(db, "listening_progress", user.uid),
          {
            uid: user.uid,
            telefonataResponses: { [phaseKey]: transcription },
            telefonataEvaluations: {
              [phaseKey]: {
                result,
                evaluatedAtMs: Date.now(),
              },
            },
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      }

      if (passed || attemptCount + 1 >= MAX_ATTEMPTS) {
        await setDoc(
          doc(db, "listening_progress", user.uid),
          {
            telefonata: { [phaseKey]: true },
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Valutazione non riuscita");
    } finally {
      setProcessing(false);
    }
  }

  const passed = phasePassed(aiResult);
  const canFinish =
    hasRecorded &&
    aiResult &&
    !processing &&
    (passed || attemptCount >= MAX_ATTEMPTS);

  const transcription = String(aiResult?.trascrizione ?? "").trim();
  const commento = String(aiResult?.commento ?? "").trim();
  const versione = String(aiResult?.versione_migliorata ?? "").trim();

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4">
      <div className="flex max-h-[95vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
        <div
          className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3"
          style={{ borderTop: `4px solid ${color}` }}
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              Warm-up telefonata
            </p>
            <h3 className="text-lg font-bold text-[var(--navy)]">{phase.sectionTitle}</h3>
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
          <div className="flex gap-2">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-1.5 flex-1 rounded-full"
                style={{ backgroundColor: i <= step ? color : "#E5E7EB" }}
              />
            ))}
          </div>
          <p className="mt-3 text-sm font-semibold text-[var(--navy)]">
            {step === 0 && `1️⃣ ${phase.sectionTitle} – ${step0Label(phaseKey)}`}
            {step === 1 && "2️⃣ Cosa sta accadendo davvero"}
            {step === 2 && "3️⃣ Cosa devi fare"}
            {step === 3 && "4️⃣ Simulazione attiva"}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {step === 0 ? (
            <div className="space-y-3">
              <p className="text-sm">{customerLineIntro(phaseKey)}</p>
              <div
                className="rounded-xl border px-4 py-4 text-base italic leading-relaxed"
                style={{
                  backgroundColor: `${color}14`,
                  borderColor: `${color}55`,
                }}
              >
                «{phase.customerLine}»
              </div>
              <p className="text-sm text-black/55">
                Nella simulazione risponderai con le tue parole, senza script suggerito.
              </p>
            </div>
          ) : null}

          {step === 1 ? (
            <p className="text-base leading-relaxed text-[var(--navy)]">{phase.decodifica}</p>
          ) : null}

          {step === 2 ? (
            <p className="text-base leading-relaxed text-[var(--navy)]">{phase.spiegazione}</p>
          ) : null}

          {step === 3 ? (
            <div className="space-y-4">
              <div
                className="rounded-xl border px-4 py-4 text-base italic"
                style={{
                  backgroundColor: `${color}14`,
                  borderColor: `${color}55`,
                }}
              >
                «{phase.customerLine}»
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void toggleRecording()}
                  disabled={processing}
                  className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50 ${
                    recording ? "bg-red-600" : ""
                  }`}
                  style={recording ? undefined : { backgroundColor: color }}
                >
                  <Mic className="h-4 w-4" />
                  {recording ? "Stop registrazione" : "Registra risposta"}
                </button>
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
                  <div
                    className={`rounded-lg px-3 py-2 text-sm font-semibold ${
                      passed
                        ? "bg-emerald-50 text-emerald-800"
                        : "bg-red-50 text-red-800"
                    }`}
                  >
                    {passed
                      ? "✔ Risposta sufficiente: puoi passare alla fase successiva."
                      : "✖ Risposta lontana dal corretto: ripeti la simulazione."}
                  </div>
                  {!passed && attemptCount < MAX_ATTEMPTS ? (
                    <p className="text-sm font-semibold text-red-700">
                      Tentativo {attemptCount}/{MAX_ATTEMPTS}. Registra di nuovo la tua
                      risposta.
                    </p>
                  ) : null}
                </div>
              ) : null}

              {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-[var(--line)] px-4 py-3">
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className="rounded-lg border border-[var(--line)] px-4 py-2 text-sm font-semibold disabled:opacity-40"
          >
            Indietro
          </button>
          {step < 3 ? (
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
              onClick={() => {
                onComplete();
                onClose();
              }}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
            >
              Completa fase
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
