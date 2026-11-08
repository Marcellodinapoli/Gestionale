/** Sezioni hub Credixa Legal AI — flusso redazione atti (indipendente da `/legal`). */

export type LegalAiSectionId =
  | "home"
  | "nuovoAtto"
  | "redazione"
  | "ricerca"
  | "revisione"
  | "esportazione";

export type LegalAiWorkflowStepId = Exclude<LegalAiSectionId, "home">;

export type LegalAiSectionDef = {
  id: LegalAiSectionId;
  label: string;
  href: string;
  /** Breve descrizione per home e intestazioni pagina. */
  summary: string;
  /** Ordine nel flusso di redazione (0 = home). */
  workflowStep: number;
};

export const LEGAL_AI_SECTIONS: readonly LegalAiSectionDef[] = [
  {
    id: "home",
    label: "Home",
    href: "/legal-ai",
    summary: "Avvio di una nuova redazione e accesso al flusso di lavoro.",
    workflowStep: 0,
  },
  {
    id: "nuovoAtto",
    label: "Nuovo atto",
    href: "/legal-ai/nuovo-atto",
    summary: "Selezione della tipologia di atto giudiziario o stragiudiziale.",
    workflowStep: 1,
  },
  {
    id: "redazione",
    label: "Redazione",
    href: "/legal-ai/redazione",
    summary:
      "Raccolta guidata delle informazioni e area di redazione assistita (analisi documentale inclusa nel passo).",
    workflowStep: 2,
  },
  {
    id: "ricerca",
    label: "Ricerca",
    href: "/legal-ai/ricerca",
    summary: "Ricerca normativa e giurisprudenziale tramite provider specializzati.",
    workflowStep: 3,
  },
  {
    id: "revisione",
    label: "Revisione",
    href: "/legal-ai/revisione",
    summary: "Revisione e perfezionamento del testo con assistenza AI.",
    workflowStep: 4,
  },
  {
    id: "esportazione",
    label: "Esportazione",
    href: "/legal-ai/esportazione",
    summary: "Esportazione in Word e PDF sul computer dell'utente.",
    workflowStep: 5,
  },
] as const;

export const LEGAL_AI_WORKFLOW_STEPS: readonly LegalAiWorkflowStepId[] = [
  "nuovoAtto",
  "redazione",
  "ricerca",
  "revisione",
  "esportazione",
];

export function legalAiSectionById(id: LegalAiSectionId): LegalAiSectionDef {
  const found = LEGAL_AI_SECTIONS.find((s) => s.id === id);
  if (!found) throw new Error(`Sezione Legal AI sconosciuta: ${id}`);
  return found;
}

/** Determina la sezione attiva dal pathname (prefisso `/legal-ai`). */
export function resolveLegalAiSectionFromPath(pathname: string): LegalAiSectionId {
  const normalized = pathname.replace(/\/+$/, "") || "/legal-ai";
  if (normalized === "/legal-ai") return "home";
  for (const section of LEGAL_AI_SECTIONS) {
    if (section.id === "home") continue;
    if (normalized === section.href || normalized.startsWith(`${section.href}/`)) {
      return section.id;
    }
  }
  return "home";
}

export function legalAiWorkflowNeighbors(
  stepId: LegalAiWorkflowStepId,
): { prev: LegalAiWorkflowStepId | null; next: LegalAiWorkflowStepId | null } {
  const idx = LEGAL_AI_WORKFLOW_STEPS.indexOf(stepId);
  if (idx < 0) return { prev: null, next: null };
  return {
    prev: idx > 0 ? LEGAL_AI_WORKFLOW_STEPS[idx - 1]! : null,
    next: idx < LEGAL_AI_WORKFLOW_STEPS.length - 1 ? LEGAL_AI_WORKFLOW_STEPS[idx + 1]! : null,
  };
}
