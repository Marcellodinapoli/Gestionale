"use client";

import { legalAiActTypeById } from "@/lib/legal-ai/actTypes";
import { canExportDraft } from "@/lib/legal-ai/draftPipeline";
import { exportDraftAsPdf, exportDraftAsWordDoc } from "@/lib/legal-ai/exportDocument";
import type { LegalAiArchiveEntry } from "@/lib/legal-ai/sessionTypes";
import { useLegalAiSession } from "@/components/legal-ai/LegalAiSessionProvider";

function exportTitle(entry: LegalAiArchiveEntry): string {
  if (entry.session.actTypeId) {
    try {
      return legalAiActTypeById(entry.session.actTypeId).label;
    } catch {
      return entry.label;
    }
  }
  return entry.label;
}

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString("it-IT");
  } catch {
    return iso;
  }
}

type Props = {
  showExportActions?: boolean;
};

export function LegalAiLocalArchivePanel({ showExportActions = false }: Props) {
  const { hydrated, archive, loadArchiveEntry, deleteArchiveEntry } = useLegalAiSession();

  if (!hydrated) return null;

  return (
    <section className="space-y-3 rounded-lg border border-border bg-card p-5 shadow-sm">
      <div>
        <h2 className="text-base font-semibold text-[var(--navy)]">Archivio su questo dispositivo</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Bozze salvate solo nel browser di questo PC (non sui server Credixa). Usa{" "}
          <strong>Archivia bozza</strong> in Redazione per aggiungerne una.
        </p>
      </div>
      {archive.length === 0 ? (
        <p className="rounded-md border border-dashed border-border bg-muted/20 px-4 py-6 text-sm text-muted-foreground">
          Nessuna bozza in archivio locale.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border">
          {archive.map((entry) => (
            <li
              key={entry.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"
            >
              <div className="min-w-0">
                <p className="font-medium text-[var(--navy)]">{entry.label}</p>
                <p className="text-xs text-muted-foreground">
                  Archiviata {formatWhen(entry.archivedAt)}
                  {entry.session.actTypeId
                    ? ` · ${legalAiActTypeById(entry.session.actTypeId).label}`
                    : null}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => loadArchiveEntry(entry.id)}
                  className="rounded-md border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-900 hover:bg-violet-100"
                >
                  Apri
                </button>
                {showExportActions && canExportDraft(entry.session) ? (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        exportDraftAsWordDoc(exportTitle(entry), entry.session.draftText)
                      }
                      className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted/50"
                    >
                      Word
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        exportDraftAsPdf(exportTitle(entry), entry.session.draftText)
                      }
                      className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted/50"
                    >
                      PDF
                    </button>
                  </>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`Eliminare «${entry.label}» dall'archivio locale?`)) {
                      deleteArchiveEntry(entry.id);
                    }
                  }}
                  className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-red-800 hover:bg-red-50"
                >
                  Elimina
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
