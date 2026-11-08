/** Catalogo tipologie atto (solo UI; integrazione servizi in fasi successive). */

export type LegalAiActType = {
  id: string;
  label: string;
  ambito: "Giudiziario" | "Stragiudiziale";
  description: string;
};

export const LEGAL_AI_ACT_TYPES: readonly LegalAiActType[] = [
  {
    id: "atto-citazione",
    label: "Atto di citazione",
    ambito: "Giudiziario",
    description: "Introduzione del giudizio con domanda e parti.",
  },
  {
    id: "comparsa-risposta",
    label: "Comparsa di risposta",
    ambito: "Giudiziario",
    description: "Risposta alla domanda attorea e eccezioni.",
  },
  {
    id: "ricorso",
    label: "Ricorso",
    ambito: "Giudiziario",
    description: "Procedimenti camerali o sommari.",
  },
  {
    id: "diffida",
    label: "Diffida stragiudiziale",
    ambito: "Stragiudiziale",
    description: "Messaggio in adesione prima dell’azione.",
  },
  {
    id: "lettera-formale",
    label: "Lettera formale",
    ambito: "Stragiudiziale",
    description: "Comunicazione con richiesta di adempimento.",
  },
  {
    id: "contratto",
    label: "Bozza contrattuale",
    ambito: "Stragiudiziale",
    description: "Predisposizione di clausole e obblighi.",
  },
] as const;

export function legalAiActTypeById(id: string): LegalAiActType {
  const found = LEGAL_AI_ACT_TYPES.find((a) => a.id === id);
  if (!found) throw new Error(`Tipologia atto Legal AI sconosciuta: ${id}`);
  return found;
}
