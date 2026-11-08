/**
 * Pipeline redazione Legal AI — logica pura, sostituibile con chiamate API esterne.
 * Nessun collegamento a fonti giuridiche reali in questa fase.
 */

import { legalAiActTypeById } from "@/lib/legal-ai/actTypes";
import type {
  LegalAiDraftSession,
  LegalAiIntake,
  LegalAiRevisionItem,
  LegalAiSearchHit,
} from "@/lib/legal-ai/sessionTypes";

export type LegalAiDraftGenerateInput = {
  actTypeId: string;
  intake: LegalAiIntake;
  /** Bozza esistente (rigenerazione parziale). */
  previousDraft?: string;
};

export function canStartRedazione(session: Pick<LegalAiDraftSession, "actTypeId">): boolean {
  return Boolean(session.actTypeId);
}

export function canGenerateDraft(
  session: Pick<LegalAiDraftSession, "actTypeId" | "intake">
): boolean {
  if (!session.actTypeId) return false;
  return session.intake.oggetto.trim().length > 0;
}

export function canExportDraft(session: Pick<LegalAiDraftSession, "draftText">): boolean {
  return session.draftText.trim().length > 0;
}

export function generateDraftText(input: LegalAiDraftGenerateInput): string {
  const act = legalAiActTypeById(input.actTypeId);
  const { oggetto, sintesiFatti, richieste } = input.intake;
  const o = oggetto.trim();
  const fatti = sintesiFatti.trim() || "—";
  const domande = richieste.trim() || "—";

  const header =
    act.ambito === "Giudiziario"
      ? `${act.label.toUpperCase()}`
      : `${act.label.toUpperCase()} (stragiudiziale)`;

  return [
    header,
    "",
    `Oggetto: ${o}`,
    "",
    "FATTI",
    fatti,
    "",
    act.ambito === "Giudiziario" ? "DOMANDA / ECCEZIONI" : "RICHIESTE",
    domande,
    "",
    "DISPOSITIVO / CONCLUSIONI",
    "[Bozza generata in Credixa Legal AI — integrare con il motore di redazione collegato.]",
    "",
    input.previousDraft?.trim()
      ? "---\nNota: bozza aggiornata mantenendo il testo precedente come riferimento.\n"
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function runMockLegalSearch(
  query: string,
  actTypeId: string | null
): LegalAiSearchHit[] {
  const q = query.trim();
  if (!q) return [];
  const act = actTypeId ? legalAiActTypeById(actTypeId).label : "atto";
  return [
    {
      id: "mock-1",
      title: `Riferimento normativo (placeholder) — ${q}`,
      excerpt: `Esito di ricerca simulato per «${q}» in relazione a ${act}. Collegare il provider giuridico per citazioni verificate.`,
      reference: "Placeholder — provider esterno",
    },
    {
      id: "mock-2",
      title: "Orientamento giurisprudenziale (placeholder)",
      excerpt:
        "Elenco motivi e massime da recuperare dalla banca dati configurata. Nessun dato salvato su Credixa.",
      reference: "Placeholder — provider esterno",
    },
  ];
}

export type LegalAiMockEditInput = {
  draftText: string;
  instruction: string;
  sourceFileName?: string | null;
};

/**
 * Modifica bozza simulata (sostituibile con LLM/API). Applica istruzioni testuali semplici in locale.
 */
export function runMockAiEditDraft(input: LegalAiMockEditInput): string {
  const draft = input.draftText.trim();
  const instruction = input.instruction.trim();
  if (!draft) return input.draftText;
  if (!instruction) return input.draftText;

  const lower = instruction.toLowerCase();
  let next = draft;

  if (
    /formatt|paragraf|a capo|leggibil/i.test(instruction) ||
    lower.includes("forma")
  ) {
    next = draft
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .join("\n\n");
  }

  if (/sintesi|riassum|più breve|accorcia/i.test(instruction) && next.length > 600) {
    const half = Math.max(400, Math.floor(next.length * 0.55));
    next = `${next.slice(0, half).trim()}\n\n[…]\n\n${next.slice(-200).trim()}`;
  }

  const sourceNote = input.sourceFileName
    ? `Documento di partenza: ${input.sourceFileName}. `
    : "";

  const footer = [
    "",
    "---",
    "Nota Credixa Legal AI (motore locale)",
    `${sourceNote}Istruzione applicata: «${instruction}».`,
    "Collegare il provider AI per modifiche giuridiche contestuali.",
  ].join("\n");

  if (!next.includes("Nota Credixa Legal AI (motore locale)")) {
    next = `${next}${footer}`;
  }

  return next;
}

export function runMockRevision(draftText: string): LegalAiRevisionItem[] {
  const text = draftText.trim();
  if (!text) return [];

  const items: LegalAiRevisionItem[] = [
    {
      id: "rev-structure",
      kind: "structure",
      message:
        "Verifica che oggetto, fatto, diritto e conclusioni siano distinti e coerenti con la tipologia di atto scelta.",
    },
  ];

  if (text.length < 400) {
    items.push({
      id: "rev-length",
      kind: "clarity",
      message: "La bozza è breve: valuta se servono ulteriori passaggi fattuali o motivazioni giuridiche.",
    });
  }
  if (!/\n\n/.test(text)) {
    items.push({
      id: "rev-paragraphs",
      kind: "style",
      message: "Suddividi il testo in paragrafi per migliorare la leggibilità.",
    });
  }
  items.push({
    id: "rev-citations",
    kind: "citation",
    message:
      "Controlla ogni riferimento normativo o giurisprudenziale con le fonti ufficiali prima dell'invio.",
  });

  return items;
}
