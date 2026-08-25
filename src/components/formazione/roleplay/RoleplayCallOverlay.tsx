"use client";

import { useEffect, useRef } from "react";
import {
  Loader2,
  Mic,
  PhoneOff,
  Brain,
  AlertCircle,
  Volume2,
} from "lucide-react";
import type { PracticeDataRow } from "@/lib/formazione/roleplayConfig";
import type { RoleplayHistoryMessage } from "@/lib/formazione/roleplayProgress";

export type RoleplayVoiceStatus =
  | "idle"
  | "connecting"
  | "listening"
  | "thinking"
  | "speaking"
  | "error";

function statusLabel(status: RoleplayVoiceStatus) {
  switch (status) {
    case "connecting":
      return "Connessione in corso...";
    case "listening":
      return "Parla: sei il consulente";
    case "thinking":
      return "Il debitore sta pensando...";
    case "speaking":
      return "Il debitore parla — interrompi parlando";
    case "error":
      return "Problema di connessione";
    default:
      return "Chiamata terminata";
  }
}

function StatusIcon({ status }: { status: RoleplayVoiceStatus }) {
  switch (status) {
    case "connecting":
      return <Loader2 className="h-8 w-8 animate-spin text-white" />;
    case "listening":
      return <Mic className="h-8 w-8 text-white" />;
    case "thinking":
      return <Brain className="h-8 w-8 text-white" />;
    case "speaking":
      return <Volume2 className="h-8 w-8 text-white" />;
    case "error":
      return <AlertCircle className="h-8 w-8 text-white" />;
    default:
      return <PhoneOff className="h-8 w-8 text-white" />;
  }
}

export function RoleplayCallOverlay({
  title,
  status,
  history,
  practiceData,
  onHangUp,
  showMicTapButton = false,
  onTapToSpeak,
}: {
  title: string;
  status: RoleplayVoiceStatus;
  history: RoleplayHistoryMessage[];
  practiceData: PracticeDataRow[];
  onHangUp: () => void;
  showMicTapButton?: boolean;
  onTapToSpeak?: () => void;
}) {
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = chatRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [history, status]);

  const listeningRing = status === "listening";

  return (
    <div className="fixed inset-0 z-50 bg-black/78">
      <div className="mx-auto flex h-full max-w-[960px] flex-col px-5 py-4 sm:px-6">
        <div className="flex flex-1 flex-col items-center overflow-hidden">
          <div
            className={`flex h-[72px] w-[72px] items-center justify-center rounded-full border-[3px] bg-white/10 ${
              listeningRing ? "border-sky-300" : "border-white/25"
            }`}
          >
            <StatusIcon status={status} />
          </div>
          <h3 className="mt-3.5 text-center text-lg font-bold text-white">{title}</h3>
          <p className="mt-1.5 text-center text-sm text-white/85">{statusLabel(status)}</p>

          <div className="mt-4 flex min-h-0 w-full flex-1 flex-col gap-3 lg:flex-row">
            {practiceData.length ? (
              <div className="max-h-40 w-full shrink-0 rounded-2xl border border-white/12 bg-white/8 p-3 lg:max-h-none lg:w-[280px]">
                <p className="text-sm font-bold text-white">Dati della pratica</p>
                <ul className="mt-2 max-h-28 space-y-1.5 overflow-y-auto text-[13px] leading-snug text-white/90 lg:max-h-none">
                  {practiceData.map((row, i) => (
                    <li key={`${row.label}-${i}`}>
                      {row.label ? (
                        <>
                          <span className="font-bold">{row.label}: </span>
                          {row.value}
                        </>
                      ) : (
                        row.value
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-white/12 bg-white/8 p-3">
              <div ref={chatRef} className="min-h-0 flex-1 overflow-y-auto">
                {!history.length ? (
                  <p className="py-8 text-center text-sm text-white/55">
                    La conversazione apparirà qui...
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {history.map((entry, index) => {
                      const isUser = entry.role === "user";
                      return (
                        <div
                          key={`${entry.role}-${index}`}
                          className={`max-w-[320px] rounded-xl px-3.5 py-2.5 ${
                            isUser
                              ? "ml-auto bg-[#1565C0]"
                              : "mr-auto bg-white/14"
                          }`}
                        >
                          <p className="text-[11px] font-semibold text-white/75">
                            {isUser ? "Tu (consulente)" : "Debitore (AI)"}
                          </p>
                          <p className="mt-1 text-sm leading-snug text-white">
                            {entry.content}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {showMicTapButton && status === "listening" ? (
                <div className="mt-3 border-t border-white/10 pt-3">
                  <button
                    type="button"
                    onClick={onTapToSpeak}
                    className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-sky-600 text-sm font-semibold text-white"
                  >
                    <Mic className="h-4 w-4" />
                    Tocca per parlare
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onHangUp}
          className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-red-700 text-sm font-semibold text-white"
        >
          <PhoneOff className="h-4 w-4" />
          Termina chiamata
        </button>
        <p className="mt-2.5 text-center text-xs text-white/60">
          Simulazione formativa: parla come in una telefonata reale.
        </p>
      </div>
    </div>
  );
}
