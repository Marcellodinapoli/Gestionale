"use client";

import { useCallback, useRef, useState } from "react";
import type { Functions } from "firebase/functions";
import { callFormazioneFunction } from "@/lib/formazione/callable";
import type { RoleplayHistoryMessage } from "@/lib/formazione/roleplayProgress";
import type { RoleplayVoiceStatus } from "@/components/formazione/roleplay/RoleplayCallOverlay";

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string };
  }>;
};

type StartParams = {
  sessionId: string;
  prompt: string;
  practiceData: unknown[];
  scenarioWeights?: unknown;
  difficulty: string;
  personality: string;
};

function isMobileBrowser() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent.toLowerCase();
  return /iphone|ipad|ipod|android|mobile/.test(ua);
}

function getSpeechRecognitionCtor():
  | (new () => SpeechRecognitionLike)
  | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as Window & {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

export function useRoleplayVoiceSession(functions: Functions | null) {
  const [status, setStatus] = useState<RoleplayVoiceStatus>("idle");
  const [history, setHistory] = useState<RoleplayHistoryMessage[]>([]);
  const [needsMicTap, setNeedsMicTap] = useState(false);

  const activeRef = useRef(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const historyRef = useRef<RoleplayHistoryMessage[]>([]);
  const sessionRef = useRef<StartParams | null>(null);
  const awaitingReplyRef = useRef(false);
  const speakingRef = useRef(false);
  const httpInFlightRef = useRef(false);
  const lastUserTextRef = useRef("");
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const appendTranscript = useCallback((speaker: "consulente" | "debitore", text: string) => {
    const role = speaker === "consulente" ? "user" : "assistant";
    setHistory((prev) => {
      if (prev.length && prev[prev.length - 1].role === role && prev[prev.length - 1].content === text) {
        return prev;
      }
      const next = [...prev, { role, content: text }];
      historyRef.current = next;
      return next;
    });
  }, []);

  const cancelSpeech = useCallback(() => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    speakingRef.current = false;
    utteranceRef.current = null;
  }, []);

  const stopRecognition = useCallback(() => {
    try {
      recognitionRef.current?.stop();
    } catch {
      /* ignore */
    }
    recognitionRef.current = null;
  }, []);

  const speak = useCallback(
    (text: string, onDone?: () => void) => {
      if (typeof window === "undefined" || !window.speechSynthesis) {
        onDone?.();
        return;
      }

      cancelSpeech();
      speakingRef.current = true;
      setStatus("speaking");

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "it-IT";
      utterance.rate = 1;
      utterance.onend = () => {
        speakingRef.current = false;
        utteranceRef.current = null;
        onDone?.();
      };
      utterance.onerror = () => {
        speakingRef.current = false;
        utteranceRef.current = null;
        onDone?.();
      };
      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    },
    [cancelSpeech]
  );

  const sendStep = useCallback(
    async (userText: string, showError = true) => {
      if (!functions || !sessionRef.current || !activeRef.current || httpInFlightRef.current) {
        return;
      }

      httpInFlightRef.current = true;
      awaitingReplyRef.current = true;
      setStatus("thinking");

      try {
        const session = sessionRef.current;
        const data = await callFormazioneFunction<{ reply?: string; role?: string }>(
          functions,
          "roleplayStep",
          {
            userText,
            prompt: session.prompt,
            sessionId: session.sessionId,
            history: historyRef.current,
            practiceData: session.practiceData,
            scenarioWeights: session.scenarioWeights,
            difficulty: session.difficulty,
            personality: session.personality,
          }
        );

        if (!activeRef.current || !awaitingReplyRef.current) return;

        const reply = String(data.reply ?? "").trim();
        if (!reply || reply.toLowerCase() === "errore") {
          if (showError) {
            activeRef.current = false;
            setStatus("error");
          }
          return;
        }

        awaitingReplyRef.current = false;
        appendTranscript("debitore", reply);
        speak(reply, () => {
          if (!activeRef.current) return;
          setStatus("listening");
          if (!isMobileBrowser()) {
            try {
              recognitionRef.current?.start();
            } catch {
              /* ignore */
            }
          } else {
            setNeedsMicTap(true);
          }
        });
      } catch {
        if (showError) {
          activeRef.current = false;
          setStatus("error");
        }
      } finally {
        httpInFlightRef.current = false;
      }
    },
    [appendTranscript, functions, speak]
  );

  const initRecognition = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor || recognitionRef.current) return;

    const recognition = new Ctor();
    recognition.lang = "it-IT";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      if (!activeRef.current || awaitingReplyRef.current) return;

      let finalText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalText += result[0].transcript;
        } else if (speakingRef.current && result[0].transcript.trim().length >= 3) {
          cancelSpeech();
        }
      }

      finalText = finalText.trim();
      if (!finalText || finalText === lastUserTextRef.current) return;
      lastUserTextRef.current = finalText;

      appendTranscript("consulente", finalText);
      stopRecognition();
      void sendStep(finalText, false);
    };

    recognition.onerror = () => {
      if (!activeRef.current) return;
      if (isMobileBrowser()) setNeedsMicTap(true);
    };

    recognition.onend = () => {
      if (!activeRef.current || awaitingReplyRef.current || speakingRef.current) return;
      if (isMobileBrowser()) {
        setNeedsMicTap(true);
        return;
      }
      window.setTimeout(() => {
        if (!activeRef.current || awaitingReplyRef.current || speakingRef.current) return;
        try {
          recognition.start();
        } catch {
          /* ignore */
        }
      }, 300);
    };

    recognitionRef.current = recognition;
  }, [appendTranscript, cancelSpeech, sendStep, stopRecognition]);

  const requestMicrophone = useCallback(() => {
    if (!activeRef.current || awaitingReplyRef.current || speakingRef.current) return;
    if (typeof window !== "undefined") window.speechSynthesis?.resume();
    setNeedsMicTap(false);
    initRecognition();
    try {
      recognitionRef.current?.start();
      setStatus("listening");
    } catch {
      setNeedsMicTap(true);
    }
  }, [initRecognition]);

  const stop = useCallback(async () => {
    activeRef.current = false;
    awaitingReplyRef.current = false;
    stopRecognition();
    cancelSpeech();
    setNeedsMicTap(false);
    setStatus("idle");
  }, [cancelSpeech, stopRecognition]);

  const start = useCallback(
    async (params: StartParams) => {
      activeRef.current = false;
      awaitingReplyRef.current = false;
      stopRecognition();
      cancelSpeech();
      setNeedsMicTap(false);
      setHistory([]);
      historyRef.current = [];

      sessionRef.current = params;
      activeRef.current = true;
      awaitingReplyRef.current = true;
      lastUserTextRef.current = "";
      setStatus("connecting");
      setNeedsMicTap(isMobileBrowser());

      if (typeof window !== "undefined") window.speechSynthesis?.resume();
      if (!isMobileBrowser()) initRecognition();
      await sendStep("", true);
    },
    [cancelSpeech, initRecognition, sendStep, stopRecognition]
  );

  return {
    status,
    history,
    needsMicTap,
    isMobileBrowser: isMobileBrowser(),
    start,
    stop,
    requestMicrophone,
  };
}
