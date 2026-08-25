"use client";

import { useEffect, useState } from "react";
import { TrainingMaterialTabs } from "@/components/formazione/warmup/WarmupUi";
import {
  difficultyLabel,
  personalityLabel,
  practiceDataForDisplay,
  resolveAiProvider,
  resolveDifficulty,
  resolvePersonality,
  resolveSimulationPrompt,
} from "@/lib/formazione/roleplayConfig";
import {
  formatDateTime,
  formatDuration,
  isLongEnoughForSuggestion,
  type RoleplaySimulationDetail,
} from "@/lib/formazione/roleplayProgress";

export function buildSimulationPayload(data: Record<string, unknown>) {
  return {
    title: String(data.title ?? "Simulazione"),
    prompt: resolveSimulationPrompt(data),
    gptPrompt: String(data.gptPrompt ?? data.prompt ?? ""),
    practiceData: data.practiceData ?? [],
    scenarioWeights: data.scenarioWeights,
    difficulty: resolveDifficulty(data),
    personality: resolvePersonality(data),
    aiProvider: resolveAiProvider(data),
  };
}

export function RoleplayResultsModal({
  open,
  title,
  simulationData,
  detail,
  generating,
  initialTab = "conversation",
  onClose,
  onGenerate,
}: {
  open: boolean;
  title: string;
  simulationData: Record<string, unknown>;
  detail?: RoleplaySimulationDetail;
  generating: boolean;
  initialTab?: "conversation" | "evaluation";
  onClose: () => void;
  onGenerate: () => void;
}) {
  const [tab, setTab] = useState<"conversation" | "evaluation">(initialTab);

  useEffect(() => {
    if (open) setTab(initialTab);
  }, [open, initialTab]);

  if (!open) return null;

  const practiceData = practiceDataForDisplay(simulationData.practiceData);
  const sessionLabel = detail?.conversationAt
    ? formatDateTime(detail.conversationAt)
    : detail?.evaluatedAt
      ? formatDateTime(detail.evaluatedAt)
      : "";
  const durationLabel = detail ? formatDuration(detail.durationMs) : "";
  const longEnough = isLongEnoughForSuggestion(detail);
  const canGenerate =
    Boolean(detail?.history.length) &&
    longEnough &&
    !generating &&
    !detail?.suggestion?.trim();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-[#E2E8F0] px-5 py-4">
          <h3 className="text-lg font-bold text-black/87">{title}</h3>
          {sessionLabel ? (
            <p className="mt-1 text-sm text-black/55">
              Sessione {sessionLabel}
              {durationLabel ? ` · Durata ${durationLabel}` : ""}
            </p>
          ) : null}
        </div>

        <TrainingMaterialTabs
          active={tab}
          onChange={setTab}
          tabs={[
            { id: "conversation", label: "Conversazione" },
            { id: "evaluation", label: "Valutazione" },
          ]}
        />

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {tab === "conversation" ? (
            <div className="space-y-3">
              {practiceData.length ? (
                <div className="rounded-xl border border-[#E2E8F0] bg-[#FAFBFC] p-4">
                  <p className="text-sm font-bold text-black/87">Dati pratica</p>
                  <ul className="mt-2 space-y-1 text-sm text-black/75">
                    {practiceData.map((row, i) => (
                      <li key={`${row.label}-${i}`}>
                        {row.label ? (
                          <>
                            <span className="font-semibold">{row.label}: </span>
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
              {(detail?.history ?? []).map((msg, i) => (
                <div
                  key={`${msg.role}-${i}`}
                  className={`max-w-[85%] rounded-xl px-4 py-3 text-sm ${
                    msg.role === "user"
                      ? "ml-auto bg-[#1565C0] text-white"
                      : "bg-[#ECEFF1] text-black/87"
                  }`}
                >
                  <p className="mb-1 text-[11px] font-semibold opacity-75">
                    {msg.role === "user" ? "Consulente" : "Debitore"}
                  </p>
                  {msg.content}
                </div>
              ))}
              {!detail?.history.length ? (
                <p className="py-8 text-center text-sm text-black/55">
                  Nessuna conversazione salvata.
                </p>
              ) : null}
            </div>
          ) : (
            <div className="space-y-4">
              {detail?.suggestion ? (
                <div className="whitespace-pre-wrap rounded-xl border border-[#E2E8F0] bg-[#FAFBFC] p-4 text-sm leading-relaxed text-black/87">
                  {detail.suggestion}
                </div>
              ) : (
                <p className="text-sm text-black/55">
                  {detail?.history.length && !longEnough
                    ? "Simulazione durata troppo poco."
                    : "Nessuna valutazione disponibile."}
                </p>
              )}
              <button
                type="button"
                disabled={!canGenerate}
                onClick={onGenerate}
                className="rounded-lg border border-black/45 px-4 py-2.5 text-sm font-medium text-black/87 enabled:hover:bg-black/[0.03] disabled:text-black/35"
              >
                {generating
                  ? "Generazione in corso..."
                  : detail?.suggestion
                    ? "Suggerimento già sviluppato"
                    : "Sviluppa suggerimento"}
              </button>
              <p className="text-xs text-black/55">
                Difficoltà: {difficultyLabel(resolveDifficulty(simulationData))} ·
                Personalità: {personalityLabel(resolvePersonality(simulationData))}
              </p>
            </div>
          )}
        </div>

        <div className="border-t border-[#E2E8F0] px-5 py-3 text-right">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-[#1565C0] hover:bg-[#1565C0]/5"
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
}
