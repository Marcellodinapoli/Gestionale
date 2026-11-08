"use client";

import Link from "next/link";
import { legalAiActTypeById } from "@/lib/legal-ai/actTypes";
import { canExportDraft } from "@/lib/legal-ai/draftPipeline";
import { exportDraftAsPdf, exportDraftAsWordDoc } from "@/lib/legal-ai/exportDocument";
import { LegalAiLocalArchivePanel } from "@/components/legal-ai/LegalAiLocalArchivePanel";
import { useLegalAiSession } from "@/components/legal-ai/LegalAiSessionProvider";

export function LegalAiEsportazionePanel() {
  const { session, hydrated } = useLegalAiSession();

  if (!hydrated) {
    return <p className="text-sm text-muted-foreground">Caricamento sessione…</p>;
  }

  const hasDraft = canExportDraft(session);
  const title = session.actTypeId
    ? legalAiActTypeById(session.actTypeId).label
    : "Bozza atto";

  return (
    <div className="space-y-6">
      <div className="max-w-xl space-y-4 rounded-lg border border-border bg-card p-5 shadow-sm">
        <h2 className="text-base font-semibold text-[var(--navy)]">Esporta bozza in lavorazione</h2>
        {!hasDraft ? (
          <p className="text-sm text-amber-950">
            Nessun testo attivo. Vai a{" "}
            <Link href="/legal-ai/redazione" className="font-medium underline">
              Redazione
            </Link>{" "}
            o apri una bozza dall&apos;archivio.
          </p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Scarica sul computer il documento aperto in revisione. Non viene inviato ai server
              Credixa.
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => exportDraftAsWordDoc(title, session.draftText)}
                className="rounded-lg border border-violet-200 bg-violet-700 px-4 py-2 text-sm font-medium text-white hover:bg-violet-800"
              >
                Esporta Word (.doc)
              </button>
              <button
                type="button"
                onClick={() => exportDraftAsPdf(title, session.draftText)}
                className="rounded-lg border border-border bg-white px-4 py-2 text-sm font-medium text-[var(--navy)] hover:bg-muted/50"
              >
                Esporta PDF
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              {session.draftText.trim().length} caratteri · {title}
            </p>
          </>
        )}
      </div>
      <LegalAiLocalArchivePanel showExportActions />
    </div>
  );
}
