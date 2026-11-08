"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { LEGAL_AI_ACT_TYPES } from "@/lib/legal-ai/actTypes";
import { useLegalAiSession } from "@/components/legal-ai/LegalAiSessionProvider";

export function LegalAiActTypePicker() {
  const { session, setActTypeId, hydrated } = useLegalAiSession();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (hydrated) setSelectedId(session.actTypeId);
  }, [hydrated, session.actTypeId]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Seleziona una tipologia per proseguire nel flusso. Il lavoro in corso si salva nel browser
        di questo PC (non sui server Credixa).
      </p>
      <ul className="grid gap-3 sm:grid-cols-2">
        {LEGAL_AI_ACT_TYPES.map((act) => {
          const selected = selectedId === act.id;
          return (
            <li key={act.id}>
              <button
                type="button"
                onClick={() => {
                  setSelectedId(act.id);
                  setActTypeId(act.id);
                }}
                className={`w-full rounded-lg border px-4 py-3 text-left shadow-sm transition ${
                  selected
                    ? "border-violet-400 bg-violet-50 ring-2 ring-violet-200"
                    : "border-border bg-card hover:border-violet-200 hover:bg-violet-50/30"
                }`}
                aria-pressed={selected}
              >
                <span className="text-[10px] font-semibold uppercase tracking-wide text-violet-700">
                  {act.ambito}
                </span>
                <span className="mt-1 block font-medium text-[var(--navy)]">{act.label}</span>
                <span className="mt-1 block text-sm text-muted-foreground">{act.description}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {selectedId ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-violet-900" role="status">
            Tipologia selezionata:{" "}
            <strong>{LEGAL_AI_ACT_TYPES.find((a) => a.id === selectedId)?.label}</strong>.
          </p>
          <Link
            href="/legal-ai/redazione"
            className="inline-flex items-center gap-1 rounded-md bg-violet-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-800"
          >
            Vai a Redazione
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      ) : null}
    </div>
  );
}
