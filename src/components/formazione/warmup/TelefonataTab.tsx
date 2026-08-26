"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { doc, getDoc } from "firebase/firestore";
import { useFormazione } from "@/components/formazione/FormazioneProvider";
import { colorFromValue, PHASE_UI_SUBTITLES } from "@/lib/formazione/warmupDefaults";
import { CallTrainingModal } from "@/components/formazione/warmup/CallTrainingModal";
import { PhaseCard } from "@/components/formazione/warmup/WarmupUi";

type ProgressMap = Record<string, boolean>;

function isPhaseEnabled(phase: string, completed: ProgressMap) {
  switch (phase) {
    case "Approccio":
      return true;
    case "Presentazione":
    case "Presentazione_standard":
    case "Presentazione_privacy":
      return completed.Approccio === true;
    case "Motivo_della_chiamata":
      return (
        completed.Presentazione_standard === true &&
        completed.Presentazione_privacy === true
      );
    case "Negoziazione":
      return completed.Motivo_della_chiamata === true;
    case "Chiusura":
      return (
        completed.Motivo_della_chiamata === true &&
        completed.Negoziazione === true
      );
    default:
      return false;
  }
}

export function TelefonataTab() {
  const { db, user } = useFormazione();
  const [completed, setCompleted] = useState<ProgressMap>({});
  const [presentazioneOpen, setPresentazioneOpen] = useState(false);
  const [activePhase, setActivePhase] = useState<string | null>(null);

  useEffect(() => {
    if (!db || !user) return;
    let cancelled = false;
    void getDoc(doc(db, "listening_progress", user.uid)).then((snap) => {
      if (cancelled) return;
      const telefonata = snap.data()?.telefonata;
      if (telefonata && typeof telefonata === "object") {
        const map: ProgressMap = {};
        for (const [k, v] of Object.entries(telefonata)) {
          map[k] = v === true;
        }
        setCompleted(map);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [db, user]);

  const presentazioneDone =
    completed.Presentazione_standard === true ||
    completed.Presentazione_privacy === true;

  return (
    <div className="w-full space-y-4 py-2">
      <PhaseCard
        title="Approccio"
        subtitle={PHASE_UI_SUBTITLES.Approccio!}
        color={colorFromValue(0xfffb8c00)}
        completed={completed.Approccio === true}
        enabled={isPhaseEnabled("Approccio", completed)}
        onClick={() => setActivePhase("Approccio")}
      />

      <div className="overflow-hidden rounded-2xl">
        <PhaseCard
          title="Presentazione"
          subtitle={PHASE_UI_SUBTITLES.Presentazione!}
          color={colorFromValue(0xff1e88e5)}
          completed={presentazioneDone}
          enabled={isPhaseEnabled("Presentazione", completed)}
          onClick={() => setPresentazioneOpen((v) => !v)}
          trailing={
            <ChevronDown
              className={`h-5 w-5 text-black/35 transition-transform ${
                presentazioneOpen ? "rotate-180" : ""
              }`}
            />
          }
        />
        {presentazioneOpen ? (
          <div className="space-y-4 border border-t-0 border-[var(--line)] bg-white px-4 pb-4 pt-2">
            <div className="pl-5">
              <PhaseCard
                title="Presentazione standard"
                subtitle={PHASE_UI_SUBTITLES.Presentazione_standard!}
                color={colorFromValue(0xff1e88e5)}
                completed={completed.Presentazione_standard === true}
                enabled={isPhaseEnabled("Presentazione_standard", completed)}
                onClick={() => setActivePhase("Presentazione_standard")}
              />
            </div>
            <div className="pl-5">
              <PhaseCard
                title="Presentazione privacy"
                subtitle={PHASE_UI_SUBTITLES.Presentazione_privacy!}
                color={colorFromValue(0xff1565c0)}
                completed={completed.Presentazione_privacy === true}
                enabled={isPhaseEnabled("Presentazione_privacy", completed)}
                onClick={() => setActivePhase("Presentazione_privacy")}
              />
            </div>
          </div>
        ) : null}
      </div>

      <PhaseCard
        title="Motivo della chiamata"
        subtitle={PHASE_UI_SUBTITLES.Motivo_della_chiamata!}
        color={colorFromValue(0xff00897b)}
        completed={completed.Motivo_della_chiamata === true}
        enabled={isPhaseEnabled("Motivo_della_chiamata", completed)}
        onClick={() => setActivePhase("Motivo_della_chiamata")}
      />

      <PhaseCard
        title="Negoziazione"
        subtitle={PHASE_UI_SUBTITLES.Negoziazione!}
        color={colorFromValue(0xff5e35b1)}
        completed={completed.Negoziazione === true}
        enabled={isPhaseEnabled("Negoziazione", completed)}
        onClick={() => setActivePhase("Negoziazione")}
      />

      <PhaseCard
        title="Chiusura"
        subtitle={PHASE_UI_SUBTITLES.Chiusura!}
        color={colorFromValue(0xff43a047)}
        completed={completed.Chiusura === true}
        enabled={isPhaseEnabled("Chiusura", completed)}
        onClick={() => setActivePhase("Chiusura")}
      />

      {activePhase ? (
        <CallTrainingModal
          phaseKey={activePhase}
          onClose={() => setActivePhase(null)}
          onComplete={() => {
            setCompleted((prev) => ({ ...prev, [activePhase]: true }));
          }}
        />
      ) : null}
    </div>
  );
}
