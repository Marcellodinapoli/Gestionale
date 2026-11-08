"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { legalAiActTypeById } from "@/lib/legal-ai/actTypes";
import {
  canExportDraft,
  canGenerateDraft,
  canStartRedazione,
  generateDraftText,
} from "@/lib/legal-ai/draftPipeline";
import { LegalAiDocumentLoadPanel } from "@/components/legal-ai/LegalAiDocumentLoadPanel";
import { useLegalAiSession } from "@/components/legal-ai/LegalAiSessionProvider";

export function LegalAiRedazionePanel() {
  const { session, setIntake, setDraftText, hydrated, saveToArchive } = useLegalAiSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [archiveMsg, setArchiveMsg] = useState<string | null>(null);

  const actLabel = useMemo(() => {
    if (!session.actTypeId) return null;
    return legalAiActTypeById(session.actTypeId).label;
  }, [session.actTypeId]);

  if (!hydrated) {
    return <p className="text-sm text-muted-foreground">Caricamento sessione…</p>;
  }

  if (!canStartRedazione(session)) {
    return (
      <div className="space-y-6">
        <LegalAiDocumentLoadPanel heading="Carica documento da file (visione e modifica AI)" />
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Per il questionario guidato seleziona prima la tipologia di atto in{" "}
          <Link href="/legal-ai/nuovo-atto" className="font-medium underline">
            Nuovo atto
          </Link>
          . Puoi comunque caricare un file e lavorarci in{" "}
          <Link href="/legal-ai/revisione" className="font-medium underline">
            Revisione
          </Link>
          .
        </p>
      </div>
    );
  }

  async function onGenerate() {
    setError(null);
    if (!session.actTypeId || !canGenerateDraft(session)) {
      setError("Compila almeno l'oggetto dell'atto.");
      return;
    }
    setBusy(true);
    try {
      const text = generateDraftText({
        actTypeId: session.actTypeId,
        intake: session.intake,
        previousDraft: session.draftText,
      });
      setDraftText(text);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <LegalAiDocumentLoadPanel heading="Carica documento da file (visione e modifica AI)" />
      <div className="grid gap-6 lg:grid-cols-2">
      <section
        aria-labelledby="legal-ai-intake-heading"
        className="space-y-3 rounded-lg border border-border bg-card p-5 shadow-sm"
      >
        <h2 id="legal-ai-intake-heading" className="text-base font-semibold text-[var(--navy)]">
          Raccolta informazioni
        </h2>
        <p className="text-sm text-muted-foreground">
          Tipologia: <strong>{actLabel}</strong>. I dati alimentano la bozza (motore sostituibile con
          API esterna).
        </p>
        <div className="space-y-3">
          <label className="block text-sm font-medium text-[var(--navy)]">
            Oggetto dell&apos;atto
            <input
              type="text"
              value={session.intake.oggetto}
              onChange={(e) => setIntake({ oggetto: e.target.value })}
              placeholder="Es. risarcimento danni"
              className="mt-1 w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm font-medium text-[var(--navy)]">
            Sintesi dei fatti
            <textarea
              rows={4}
              value={session.intake.sintesiFatti}
              onChange={(e) => setIntake({ sintesiFatti: e.target.value })}
              placeholder="Descrivi i fatti principali…"
              className="mt-1 w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm font-medium text-[var(--navy)]">
            Richieste al giudice / controparte
            <textarea
              rows={3}
              value={session.intake.richieste}
              onChange={(e) => setIntake({ richieste: e.target.value })}
              placeholder="Domande, eccezioni o richieste…"
              className="mt-1 w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
            />
          </label>
        </div>
        <button
          type="button"
          disabled={busy || !canGenerateDraft(session)}
          onClick={() => void onGenerate()}
          className="inline-flex items-center gap-2 rounded-lg bg-violet-700 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-800 disabled:opacity-50"
        >
          <Sparkles className="h-4 w-4" aria-hidden />
          {busy ? "Generazione…" : "Genera bozza"}
        </button>
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="button"
            disabled={!canExportDraft(session)}
            onClick={() => {
              const res = saveToArchive();
              setArchiveMsg(
                res.ok ? "Bozza aggiunta all'archivio su questo dispositivo." : res.message ?? ""
              );
            }}
            className="rounded-lg border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-semibold text-violet-900 hover:bg-violet-100 disabled:opacity-50"
          >
            Archivia bozza
          </button>
        </div>
        {archiveMsg ? <p className="text-sm text-violet-900">{archiveMsg}</p> : null}
      </section>

      <section
        aria-labelledby="legal-ai-draft-heading"
        className="space-y-3 rounded-lg border border-border bg-card p-5 shadow-sm"
      >
        <h2 id="legal-ai-draft-heading" className="text-base font-semibold text-[var(--navy)]">
          Area di redazione
        </h2>
        <p className="text-sm text-muted-foreground">
          Modifica liberamente la bozza; le modifiche si salvano automaticamente nel browser di
          questo PC.
        </p>
        <textarea
          rows={14}
          value={session.draftText}
          onChange={(e) => setDraftText(e.target.value)}
          placeholder="Genera la bozza dal questionario oppure scrivi qui…"
          className="w-full rounded-md border border-border bg-white px-3 py-2 font-mono text-sm"
        />
      </section>
      </div>
    </div>
  );
}
