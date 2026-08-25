/**
 * Config roleplay allineata a CreditCalc (`RoleplayConfigService`) e backoffice.
 * Fonte operativa: documenti Firestore `roleplay/{id}` (campi `prompt` / `gptPrompt`,
 * `difficulty`, `personality`, `aiProvider`, `practiceData`) gestiti dal BK.
 */
import { DEFAULT_ROLEPLAY_SIMULATION_PROMPT } from "@/lib/formazione/roleplayDefaultPrompt";

export const ROLEPLAY_COLLECTION = "roleplay";
export const ROLEPLAY_PROMPT_FIELD = "prompt";
export const ROLEPLAY_LEGACY_GPT_PROMPT_FIELD = "gptPrompt";
export const ROLEPLAY_AI_PROVIDER_FIELD = "aiProvider";
export const ROLEPLAY_DIFFICULTY_FIELD = "difficulty";
export const ROLEPLAY_PERSONALITY_FIELD = "personality";

export const ROLEPLAY_AI_PROVIDER_OPENAI = "gpt";
export const ROLEPLAY_AI_PROVIDER_REALTIME = "realtime";
export const ROLEPLAY_DEFAULT_AI_PROVIDER = ROLEPLAY_AI_PROVIDER_REALTIME;

export const ROLEPLAY_DIFFICULTIES = [
  "facile",
  "media",
  "difficile",
  "esperto",
] as const;

export const ROLEPLAY_PERSONALITIES = [
  "collaborativo",
  "diffidente",
  "aggressivo",
  "manipolatore",
  "emotivo",
  "razionale",
  "realistico",
] as const;

export const ROLEPLAY_DEFAULT_DIFFICULTY = "media";
export const ROLEPLAY_DEFAULT_PERSONALITY = "collaborativo";
export const DEFAULT_SIMULATION_PROMPT = DEFAULT_ROLEPLAY_SIMULATION_PROMPT;

export function resolveDifficulty(data: Record<string, unknown>) {
  const raw = String(data[ROLEPLAY_DIFFICULTY_FIELD] ?? "")
    .trim()
    .toLowerCase();
  return (ROLEPLAY_DIFFICULTIES as readonly string[]).includes(raw)
    ? raw
    : ROLEPLAY_DEFAULT_DIFFICULTY;
}

export function resolvePersonality(data: Record<string, unknown>) {
  const raw = String(data[ROLEPLAY_PERSONALITY_FIELD] ?? "")
    .trim()
    .toLowerCase();
  return (ROLEPLAY_PERSONALITIES as readonly string[]).includes(raw)
    ? raw
    : ROLEPLAY_DEFAULT_PERSONALITY;
}

export function difficultyLabel(value: string) {
  switch (value) {
    case "facile":
      return "Facile";
    case "difficile":
      return "Difficile";
    case "esperto":
      return "Esperto";
    default:
      return "Media";
  }
}

export function personalityLabel(value: string) {
  switch (value) {
    case "collaborativo":
      return "Collaborativo";
    case "diffidente":
      return "Diffidente";
    case "aggressivo":
      return "Aggressivo";
    case "manipolatore":
      return "Manipolatore";
    case "emotivo":
      return "Emotivo";
    case "razionale":
      return "Razionale";
    case "realistico":
      return "Realistico/Misto";
    default:
      return "Collaborativo";
  }
}

function difficultyHint(value: string) {
  switch (value) {
    case "facile":
      return "poche obiezioni, tono generalmente disponibile al dialogo.";
    case "difficile":
      return "resistenza frequente, obiezioni solide e tono teso.";
    case "esperto":
      return "scenario complesso con obiezioni articolate, rinvii e negoziazione ostica.";
    default:
      return "equilibrio tra collaborazione e opposizione, obiezioni moderate.";
  }
}

function personalityHint(value: string) {
  switch (value) {
    case "collaborativo":
      return "aperto al confronto, propone soluzioni e chiede chiarimenti.";
    case "diffidente":
      return "diffida, chiede garanzie e verifiche prima di impegnarsi.";
    case "aggressivo":
      return "tono elevato, interruzioni, minacce o rifiuti netti.";
    case "manipolatore":
      return "devia il discorso, altera i fatti o colpevolizza l'interlocutore.";
    case "emotivo":
      return "reazioni emotive marcate (ansia, stress, frustrazione).";
    case "razionale":
      return "freddo e procedurale, chiede dettagli e contesta con logica.";
    case "realistico":
      return (
        "misto realistico: durante la conversazione alterna e combina tratti di " +
        "aggressivo, collaborativo, diffidente, emotivo e manipolatore; " +
        "non restare su un solo stile."
      );
    default:
      return "aperto al confronto, propone soluzioni e chiede chiarimenti.";
  }
}

/** Blocco PARAMETRI SIMULAZIONE (come CreditCalc / Functions). */
export function behaviorContextBlock(data: Record<string, unknown>) {
  const difficulty = resolveDifficulty(data);
  const personality = resolvePersonality(data);
  return [
    "PARAMETRI SIMULAZIONE:",
    `Difficoltà (${difficultyLabel(difficulty)}): ${difficultyHint(difficulty)}`,
    `Personalità (${personalityLabel(personality)}): ${personalityHint(personality)}`,
    "Rispetta sempre questi parametri nel tono e nel livello di opposizione.",
    "Hanno priorità su eventuali istruzioni di scelta casuale nel prompt.",
  ].join("\n");
}

/**
 * Prompt salvato dal backoffice sul documento `roleplay/{id}`.
 * Ordine: `prompt` → legacy `gptPrompt` → default CreditCalc/BK.
 */
export function resolveSimulationPrompt(data: Record<string, unknown>) {
  const prompt = String(data[ROLEPLAY_PROMPT_FIELD] ?? "").trim();
  if (prompt) return prompt;
  const legacy = String(data[ROLEPLAY_LEGACY_GPT_PROMPT_FIELD] ?? "").trim();
  if (legacy) return legacy;
  return DEFAULT_SIMULATION_PROMPT;
}

/** Solo valore persistito (senza default), utile per UI admin. */
export function resolveStoredSimulationPrompt(data: Record<string, unknown>) {
  const prompt = String(data[ROLEPLAY_PROMPT_FIELD] ?? "").trim();
  if (prompt) return prompt;
  return String(data[ROLEPLAY_LEGACY_GPT_PROMPT_FIELD] ?? "").trim();
}

export function resolveAiProvider(data: Record<string, unknown>) {
  const raw = String(data[ROLEPLAY_AI_PROVIDER_FIELD] ?? "")
    .trim()
    .toLowerCase();
  if (!raw) return ROLEPLAY_DEFAULT_AI_PROVIDER;
  if (raw === ROLEPLAY_AI_PROVIDER_OPENAI || raw === "hetzner") {
    return ROLEPLAY_AI_PROVIDER_OPENAI;
  }
  if (raw === ROLEPLAY_AI_PROVIDER_REALTIME) {
    return ROLEPLAY_AI_PROVIDER_REALTIME;
  }
  return ROLEPLAY_DEFAULT_AI_PROVIDER;
}
