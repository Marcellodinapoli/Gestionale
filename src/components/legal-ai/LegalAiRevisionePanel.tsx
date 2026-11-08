"use client";

import Link from "next/link";
import { useState } from "react";
import { PenLine } from "lucide-react";
import { LegalAiLocalArchivePanel } from "@/components/legal-ai/LegalAiLocalArchivePanel";
import { LegalAiDocumentLoadPanel } from "@/components/legal-ai/LegalAiDocumentLoadPanel";
import { canExportDraft, runMockRevision } from "@/lib/legal-ai/draftPipeline";
import { useLegalAiSession } from "@/components/legal-ai/LegalAiSessionProvider";

export function LegalAiRevisionePanel() {
  const { session, setDraftText, setRevisionItems, hydrated } = useLegalAiSession();
  const [busy, setBusy] = useState(false);

  if (!hydrated) {
    return <p className="text-sm text-muted-foreground">Caricamento sessione…</p>;
  }

  const hasDraft = canExportDraft(session);

  function onRevise() {
    setBusy(true);
    try {
      setRevisionItems(runMockRevision(session.draftText));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {!hasDraft ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Nessuna bozza in lavorazione. Generane una in{" "}
          <Link href="/legal-ai/redazione" className="font-medium underline">
            Redazione
          </Link>{" "}
          oppure apri una voce dall&apos;archivio sotto.
        </p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="space-y-3 rounded-lg border border-border bg-card p-5 shadow-sm">
            <h2 className="text-base font-semibold text-[var(--navy)]">Testo in revisione</h2>
            <textarea
              rows={16}
              value={session.draftText}
              onChange={(e) => setDraftText(e.target.value)}
              className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
            />
          </section>
          <section className="space-y-3 rounded-lg border border-border bg-card p-5 shadow-sm">
            <h2 className="text-base font-semibold text-[var(--navy)]">
              Suggerimenti e perfezionamento AI
            </h2>
            <p className="text-sm text-muted-foreground">
              Analisi locale sostituibile con il motore di revisione collegato.
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={onRevise}
              className="inline-flex items-center gap-2 rounded-lg bg-violet-700 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-800 disabled:opacity-50"
            >
              <PenLine className="h-4 w-4" aria-hidden />
              {busy ? "Analisi…" : "Analizza bozza"}
            </button>
            {session.revisionItems.length === 0 ? (
              <div className="rounded-md border border-dashed border-border bg-muted/20 px-4 py-6 text-sm text-muted-foreground">
                Esegui l&apos;analisi per ottenere suggerimenti.
              </div>
            ) : (
              <ul className="space-y-2">
                {session.revisionItems.map((item) => (
                  <li
                    key={item.id}
                    className="rounded-md border border-violet-100 bg-violet-50/40 px-3 py-2 text-sm text-violet-950"
                  >
                    {item.message}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
      <LegalAiDocumentLoadPanel heading="Ricarica file e modifica con AI" />
      <LegalAiLocalArchivePanel />
    </div>
  );
}
