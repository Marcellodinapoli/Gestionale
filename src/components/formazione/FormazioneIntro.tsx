"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  BookOpen,
  Headphones,
  LineChart,
  MessagesSquare,
  Users,
  X,
} from "lucide-react";
import { useFormazione } from "@/components/formazione/FormazioneProvider";
import {
  hasSeenFormazioneIntro,
  markFormazioneIntroSeen,
} from "@/lib/formazione/introStorage";

type FormazioneIntroContextValue = {
  openIntro: () => void;
};

const FormazioneIntroContext = createContext<FormazioneIntroContextValue | null>(
  null
);

export function useFormazioneIntro() {
  const ctx = useContext(FormazioneIntroContext);
  if (!ctx) {
    throw new Error("useFormazioneIntro deve essere usato dentro FormazioneIntroHost");
  }
  return ctx;
}

const STEPS = [
  {
    icon: BookOpen,
    title: "1. Corsi",
    text: "Parti dai percorsi Sollecito e Recupero: guarda i video, completa i quiz e scarica i materiali. Ogni attività aggiorna i tuoi progressi.",
  },
  {
    icon: Headphones,
    title: "2. Warm-up",
    text: "Allena le fasi della telefonata e le contestazioni tipiche. È la preparazione pratica prima delle simulazioni.",
  },
  {
    icon: MessagesSquare,
    title: "3. Role Play",
    text: "Simula chiamate con un debitore AI su pratiche realistiche. Puoi avviare la chiamata e sviluppare suggerimenti formativi.",
  },
  {
    icon: LineChart,
    title: "4. I miei progressi",
    text: "Controlla avanzamento corsi (video, quiz, file), risultati e stato delle attività formative in un’unica vista.",
  },
] as const;

function FormazioneIntroDialog({
  open,
  canMonitor,
  onClose,
}: {
  open: boolean;
  canMonitor: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="formazione-intro-title"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-2xl border border-[var(--line)] bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--line)] bg-[#fafbfc] px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#FB8C00]">
              CreditForm
            </p>
            <h2
              id="formazione-intro-title"
              className="mt-1 text-lg font-bold text-[var(--navy)]"
            >
              Il percorso di formazione
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Segui queste sezioni in ordine per consolidare teoria e pratica sul
              recupero crediti.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--muted)] hover:bg-slate-100 hover:text-[var(--navy)]"
            aria-label="Chiudi"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[min(60vh,28rem)] space-y-3 overflow-y-auto px-5 py-4">
          {STEPS.map(({ icon: Icon, title, text }) => (
            <div
              key={title}
              className="flex gap-3 rounded-xl border border-[var(--line)] bg-[#FAFAFA] p-3.5"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#FFF3E0] text-[#FB8C00]">
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="font-semibold text-[var(--navy)]">{title}</p>
                <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">
                  {text}
                </p>
              </div>
            </div>
          ))}

          {canMonitor ? (
            <div className="flex gap-3 rounded-xl border border-[var(--line)] bg-[#FAFAFA] p-3.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#E8EEF4] text-[var(--navy)]">
                <Users className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="font-semibold text-[var(--navy)]">Collaboratori</p>
                <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">
                  Come supervisor puoi monitorare i progressi del team: corsi
                  completati, warm-up e ultima attività roleplay di ogni
                  operatore.
                </p>
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--line)] px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-[var(--navy)] px-4 py-2 text-sm font-semibold text-white hover:bg-[#132033]"
          >
            Ho capito, inizia
          </button>
        </div>
      </div>
    </div>
  );
}

export function FormazioneIntroHost({
  canMonitor = false,
  children,
}: {
  canMonitor?: boolean;
  children: ReactNode;
}) {
  const { user, ready } = useFormazione();
  const userKey = user?.uid ?? "anonymous";
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!ready) return;
    setChecked(true);
    if (!hasSeenFormazioneIntro(userKey)) {
      setOpen(true);
    }
  }, [ready, userKey]);

  const close = useCallback(() => {
    markFormazioneIntroSeen(userKey);
    setOpen(false);
  }, [userKey]);

  const openIntro = useCallback(() => {
    setOpen(true);
  }, []);

  const value = useMemo(() => ({ openIntro }), [openIntro]);

  return (
    <FormazioneIntroContext.Provider value={value}>
      {children}
      {checked ? (
        <FormazioneIntroDialog
          open={open}
          canMonitor={canMonitor}
          onClose={close}
        />
      ) : null}
    </FormazioneIntroContext.Provider>
  );
}
