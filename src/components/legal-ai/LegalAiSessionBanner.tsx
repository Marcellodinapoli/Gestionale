"use client";

import { legalAiActTypeById } from "@/lib/legal-ai/actTypes";
import { useLegalAiSession } from "@/components/legal-ai/LegalAiSessionProvider";

export function LegalAiSessionBanner() {
  const { session, hydrated, resetSession } = useLegalAiSession();
  if (!hydrated) return null;

  const hasWork =
    Boolean(session.actTypeId) ||
    Boolean(session.draftText.trim()) ||
    Boolean(session.sourceFileName);

  if (!hasWork) return null;

  const actLabel = session.actTypeId
    ? legalAiActTypeById(session.actTypeId).label
    : session.sourceFileName
      ? session.sourceFileName
      : "Documento in bozza";

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-violet-100 bg-violet-50/50 px-4 py-2 text-sm text-violet-950">
      <p>
        Redazione in corso: <strong>{actLabel}</strong>
      </p>
      <button
        type="button"
        onClick={() => {
          if (
            window.confirm(
              "Annullare il lavoro in corso su questo dispositivo? Le voci in archivio restano salvate."
            )
          ) {
            resetSession();
          }
        }}
        className="text-xs font-medium text-violet-800 underline hover:text-violet-950"
      >
        Nuova redazione
      </button>
    </div>
  );
}
