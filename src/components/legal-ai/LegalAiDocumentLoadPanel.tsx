"use client";

import { useRef, useState } from "react";
import { FileUp, Sparkles } from "lucide-react";
import {
  extractLegalAiDocumentText,
  legalAiDocumentPreview,
  legalAiImportAcceptAttribute,
} from "@/lib/legal-ai/documentImport";
import { canExportDraft, runMockAiEditDraft } from "@/lib/legal-ai/draftPipeline";
import { useLegalAiSession } from "@/components/legal-ai/LegalAiSessionProvider";

type LegalAiDocumentLoadPanelProps = {
  /** Titolo sezione (Redazione vs Revisione). */
  heading?: string;
};

export function LegalAiDocumentLoadPanel({
  heading = "Carica documento da file",
}: LegalAiDocumentLoadPanelProps) {
  const { session, setDraftText, patchSession, setRevisionItems } = useLegalAiSession();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busyLoad, setBusyLoad] = useState(false);
  const [busyAi, setBusyAi] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [instruction, setInstruction] = useState("");

  const hasDraft = canExportDraft(session);
  const preview =
    hasDraft && session.sourceFileName
      ? legalAiDocumentPreview(session.draftText)
      : hasDraft && session.draftText
        ? legalAiDocumentPreview(session.draftText)
        : null;

  async function onFileChange(file: File | undefined) {
    setError(null);
    setInfo(null);
    if (!file) return;
    setBusyLoad(true);
    try {
      const result = await extractLegalAiDocumentText(file);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setDraftText(result.text);
      patchSession({ sourceFileName: file.name, revisionItems: [] });
      setInfo(
        `File «${file.name}» caricato: l'AI lavora sul testo nell'area di redazione (${result.text.length} caratteri).`
      );
    } finally {
      setBusyLoad(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function onAiEdit() {
    setError(null);
    if (!hasDraft) {
      setError("Carica un file o scrivi una bozza prima di usare l'AI.");
      return;
    }
    if (!instruction.trim()) {
      setError("Scrivi cosa deve fare l'AI sul documento.");
      return;
    }
    setBusyAi(true);
    try {
      const next = runMockAiEditDraft({
        draftText: session.draftText,
        instruction,
        sourceFileName: session.sourceFileName,
      });
      setDraftText(next);
      setRevisionItems([]);
      setInfo("Modifica AI applicata (motore locale — collegare API per risultati avanzati).");
    } finally {
      setBusyAi(false);
    }
  }

  return (
    <section
      aria-labelledby="legal-ai-upload-heading"
      className="space-y-3 rounded-lg border border-dashed border-violet-200 bg-violet-50/30 p-5"
    >
      <h2 id="legal-ai-upload-heading" className="text-base font-semibold text-[var(--navy)]">
        {heading}
      </h2>
      <p className="text-sm text-muted-foreground">
        Il file resta sul tuo PC: viene letto nel browser e il testo alimenta la bozza. Nessun
        invio ai server Credixa.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          accept={legalAiImportAcceptAttribute()}
          className="sr-only"
          disabled={busyLoad}
          onChange={(e) => void onFileChange(e.target.files?.[0])}
        />
        <span className="text-xs text-muted-foreground">
          .txt, .md, .html, .rtf, .docx (max 1,5 MB)
        </span>
      </div>
      {session.sourceFileName ? (
        <p className="text-sm text-violet-950">
          File in lavorazione: <strong>{session.sourceFileName}</strong>
        </p>
      ) : null}
      {preview ? (
        <div className="rounded-md border border-border bg-white px-3 py-2">
          <p className="text-xs font-medium text-muted-foreground">Anteprima per l&apos;AI</p>
          <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap font-sans text-sm text-[var(--navy)]">
            {preview}
          </pre>
        </div>
      ) : null}
      <label className="block text-sm font-medium text-[var(--navy)]">
        Istruzione per l&apos;AI (modifica o integrazione)
        <textarea
          rows={2}
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          placeholder="Es. migliora la forma, aggiungi un paragrafo sul diritto applicabile…"
          className="mt-1 w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busyLoad}
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-2 rounded-lg border border-violet-300 bg-white px-4 py-2 text-sm font-semibold text-violet-900 hover:bg-violet-50 disabled:opacity-50"
        >
          <FileUp className="h-4 w-4" aria-hidden />
          {busyLoad ? "Lettura file…" : "Scegli file"}
        </button>
        <button
          type="button"
          disabled={busyAi || !hasDraft}
          onClick={onAiEdit}
          className="inline-flex items-center gap-2 rounded-lg bg-violet-700 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-800 disabled:opacity-50"
        >
          <Sparkles className="h-4 w-4" aria-hidden />
          {busyAi ? "Modifica in corso…" : "Modifica con AI"}
        </button>
      </div>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {info ? <p className="text-sm text-violet-900">{info}</p> : null}
    </section>
  );
}
