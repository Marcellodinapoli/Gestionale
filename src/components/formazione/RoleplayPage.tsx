"use client";

import { useCallback, useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  type DocumentData,
} from "firebase/firestore";
import { useFormazione } from "@/components/formazione/FormazioneProvider";
import { callFormazioneFunction } from "@/lib/formazione/callable";
import { SollecitoRecuperoTabs } from "@/components/formazione/warmup/WarmupUi";
import {
  difficultyLabel,
  normalizePracticeData,
  personalityLabel,
  practiceDataForDisplay,
  resolveAiProvider,
  resolveDifficulty,
  resolvePersonality,
  resolveSimulationPrompt,
  type PracticeDataRow,
} from "@/lib/formazione/roleplayConfig";
import {
  hasConversation,
  hasSuggestion,
  isLongEnoughForSuggestion,
  saveLastSimulation,
  saveSimulationSuggestion,
  watchSimulationDetails,
  type RoleplayHistoryMessage,
  type RoleplaySimulationDetail,
} from "@/lib/formazione/roleplayProgress";
import { RoleplayCallOverlay } from "@/components/formazione/roleplay/RoleplayCallOverlay";
import { RoleplayResultsModal } from "@/components/formazione/roleplay/RoleplayResultsModal";
import { useRoleplayVoiceSession } from "@/lib/formazione/useRoleplayVoiceSession";

type RoleplaySimulation = {
  id: string;
  title: string;
  category: string;
  raw: Record<string, unknown>;
  practiceData: PracticeDataRow[];
  difficulty: string;
  personality: string;
  prompt: string;
  aiProvider: string;
  dateMs?: number;
};

function tsToMs(value: unknown): number | undefined {
  if (!value) return undefined;
  if (typeof value === "string") {
    const ms = Date.parse(value);
    return Number.isNaN(ms) ? undefined : ms;
  }
  if (typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    return (value.toDate() as Date).getTime();
  }
  return undefined;
}

function parseSimulation(id: string, data: DocumentData): RoleplaySimulation {
  const raw = data as Record<string, unknown>;
  return {
    id,
    title: String(data.title ?? "Simulazione"),
    category: String(data.category ?? ""),
    raw,
    practiceData: practiceDataForDisplay(data.practiceData),
    difficulty: resolveDifficulty(raw),
    personality: resolvePersonality(raw),
    // Prompt ufficiale dal backoffice (`roleplay/{id}.prompt` / legacy gptPrompt).
    prompt: resolveSimulationPrompt(raw),
    aiProvider: resolveAiProvider(raw),
    dateMs: tsToMs(data.date),
  };
}

function SimulationCard({
  simulation,
  detail,
  simulationActive,
  onStart,
  onStop,
  onOpenEvaluation,
}: {
  simulation: RoleplaySimulation;
  detail?: RoleplaySimulationDetail;
  simulationActive: boolean;
  onStart: () => void;
  onStop: () => void;
  onOpenEvaluation: () => void;
}) {
  const conversation = hasConversation(detail);
  const suggestion = hasSuggestion(detail);
  const longEnough = isLongEnoughForSuggestion(detail);
  const canDevelopSuggestion =
    conversation && longEnough && !suggestion && !simulationActive;

  const suggestionButtonLabel = suggestion
    ? "Suggerimento già sviluppato"
    : "Sviluppa suggerimento";

  return (
    <article>
      <h3 className="text-base font-bold text-black">{simulation.title}</h3>
      <p className="mt-0.5 text-[13px] leading-[1.4] text-black/55">
        Difficoltà: {difficultyLabel(simulation.difficulty)} · Personalità:{" "}
        {personalityLabel(simulation.personality)}
      </p>

      {simulation.practiceData.length ? (
        <div className="mt-2 space-y-1">
          {simulation.practiceData.map((row, i) => (
            <p key={`${simulation.id}-row-${i}`} className="text-sm leading-[1.4] text-black/87">
              {row.label ? (
                <>
                  <span className="font-bold">{row.label}: </span>
                  {row.value}
                </>
              ) : (
                row.value
              )}
            </p>
          ))}
        </div>
      ) : null}

      <p className="mt-0.5 text-[11px] leading-[1.4] text-black/55">
        Valutazione automatica basata su intelligenza artificiale, a scopo formativo.
      </p>

      <div className="my-3 h-px bg-[#E0E0E0]" />

      <div className="space-y-2">
        <button
          type="button"
          disabled={!canDevelopSuggestion}
          onClick={onOpenEvaluation}
          className="w-full rounded-lg border border-black/45 bg-white px-4 py-2.5 text-sm font-medium text-black/87 enabled:hover:bg-black/[0.02] disabled:cursor-default disabled:border-black/20 disabled:bg-[#FAFAFA] disabled:text-black/35"
        >
          {suggestionButtonLabel}
        </button>
        <button
          type="button"
          onClick={simulationActive ? onStop : onStart}
          className={`w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white ${
            simulationActive
              ? "bg-[#E53935] hover:bg-[#C62828]"
              : "bg-[#FFA726] hover:bg-[#FB8C00]"
          }`}
        >
          {simulationActive ? "Termina chiamata" : "Avvia chiamata"}
        </button>
      </div>
    </article>
  );
}

function SimulationsList({ category }: { category: string }) {
  const { db, user, functions } = useFormazione();
  const [items, setItems] = useState<RoleplaySimulation[]>([]);
  const [details, setDetails] = useState<Record<string, RoleplaySimulationDetail>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSim, setActiveSim] = useState<RoleplaySimulation | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const voice = useRoleplayVoiceSession(functions);
  const [resultsSim, setResultsSim] = useState<RoleplaySimulation | null>(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (!db) return;
    const q = query(collection(db, "roleplay"), orderBy("date", "asc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const all = snap.docs.map((d) => parseSimulation(d.id, d.data()));
        setItems(all.filter((s) => s.category === category));
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [db, category]);

  useEffect(() => {
    if (!db || !user) return;
    return watchSimulationDetails(db, user.uid, setDetails);
  }, [db, user]);

  const startSimulation = useCallback(
    async (sim: RoleplaySimulation) => {
      setActiveSim(sim);
      setStartedAt(Date.now());
      // Prompt e parametri sempre dal documento BK in Firestore (live).
      const prompt = resolveSimulationPrompt(sim.raw);
      const practiceData = normalizePracticeData(sim.raw.practiceData);
      await voice.start({
        sessionId: `${sim.id}_${Date.now()}`,
        prompt,
        practiceData,
        scenarioWeights: sim.raw.scenarioWeights,
        difficulty: resolveDifficulty(sim.raw),
        personality: resolvePersonality(sim.raw),
      });
    },
    [voice]
  );

  const stopSimulation = useCallback(async () => {
    const history = voice.history;
    await voice.stop();

    if (!db || !user || !activeSim) {
      setActiveSim(null);
      setStartedAt(null);
      return;
    }

    const durationMs = startedAt ? Date.now() - startedAt : 0;
    const finalHistory: RoleplayHistoryMessage[] =
      history.length > 0
        ? history
        : [{ role: "assistant", content: "Simulazione avviata." }];
    const userExchanges = finalHistory.filter((m) => m.role === "user").length;

    await saveLastSimulation(db, user.uid, {
      simulationId: activeSim.id,
      title: activeSim.title,
      category: activeSim.category,
      practiceData: (activeSim.raw.practiceData as unknown[]) ?? [],
      userExchanges,
      totalMessages: finalHistory.length,
      history: finalHistory,
      durationMs,
    });

    setActiveSim(null);
    setStartedAt(null);
  }, [activeSim, db, startedAt, user, voice]);

  const generateSuggestion = useCallback(async () => {
    if (!functions || !db || !user || !resultsSim) return;
    const detail = details[resultsSim.id];
    if (!detail?.history.length) return;

    setGenerating(true);
    try {
      const practiceRows = normalizePracticeData(resultsSim.raw.practiceData);
      const practiceText = practiceRows
        .map((row) => (row.label ? `${row.label}: ${row.value}` : row.value))
        .join("; ");

      const data = await callFormazioneFunction<{ suggestion?: string }>(
        functions,
        "roleplaySuggestion",
        {
          prompt: resolveSimulationPrompt(resultsSim.raw),
          title: resultsSim.title,
          history: detail.history,
          practiceData: practiceRows,
          practiceText,
          difficulty: resolveDifficulty(resultsSim.raw),
          personality: resolvePersonality(resultsSim.raw),
        }
      );

      const suggestion = String(data.suggestion ?? "").trim();
      if (suggestion) {
        await saveSimulationSuggestion(db, user.uid, resultsSim.id, suggestion);
      }
    } finally {
      setGenerating(false);
    }
  }, [db, details, functions, resultsSim, user]);

  if (loading) {
    return <p className="py-12 text-center text-sm text-black/55">Caricamento…</p>;
  }

  if (error) {
    return (
      <p className="py-12 text-center text-sm text-red-600">
        ❌ Errore nel caricamento delle simulazioni
        <br />
        {error}
      </p>
    );
  }

  if (!items.length) {
    return (
      <p className="py-12 text-center text-sm text-black/55">
        Nessuna simulazione disponibile
      </p>
    );
  }

  const simulationActive = Boolean(activeSim);

  return (
    <>
      {items.map((sim) => (
        <SimulationCard
          key={sim.id}
          simulation={sim}
          detail={details[sim.id]}
          simulationActive={simulationActive}
          onStart={() => void startSimulation(sim)}
          onStop={() => void stopSimulation()}
          onOpenEvaluation={() => setResultsSim(sim)}
        />
      ))}

      {activeSim ? (
        <RoleplayCallOverlay
          title={activeSim.title}
          status={voice.status}
          history={voice.history}
          practiceData={activeSim.practiceData}
          onHangUp={() => void stopSimulation()}
          showMicTapButton={voice.needsMicTap || voice.isMobileBrowser}
          onTapToSpeak={voice.requestMicrophone}
        />
      ) : null}

      <RoleplayResultsModal
        open={Boolean(resultsSim)}
        title={resultsSim?.title ?? ""}
        simulationData={resultsSim?.raw ?? {}}
        detail={resultsSim ? details[resultsSim.id] : undefined}
        generating={generating}
        initialTab="evaluation"
        onClose={() => setResultsSim(null)}
        onGenerate={() => void generateSuggestion()}
      />
    </>
  );
}

export function RoleplayPage() {
  const [tab, setTab] = useState<"sollecito" | "recupero">("sollecito");
  const category = tab === "sollecito" ? "Sollecito" : "Recupero";

  return (
    <div className="rounded-xl border border-[#E0E0E0] bg-white shadow-none">
      <div className="px-4 pt-2">
        <SollecitoRecuperoTabs active={tab} onChange={setTab} />
      </div>
      <div className="border-t border-[#E0E0E0]" />
      <div className="p-3">
        <SimulationsList category={category} />
      </div>
    </div>
  );
}
