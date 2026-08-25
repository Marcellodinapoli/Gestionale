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

export function resolveDifficulty(data: Record<string, unknown>) {
  const raw = String(data.difficulty ?? "")
    .trim()
    .toLowerCase();
  return (ROLEPLAY_DIFFICULTIES as readonly string[]).includes(raw)
    ? raw
    : "media";
}

export function resolvePersonality(data: Record<string, unknown>) {
  const raw = String(data.personality ?? "")
    .trim()
    .toLowerCase();
  return (ROLEPLAY_PERSONALITIES as readonly string[]).includes(raw)
    ? raw
    : "collaborativo";
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

export function resolveSimulationPrompt(data: Record<string, unknown>) {
  const prompt = String(data.prompt ?? "").trim();
  if (prompt) return prompt;
  return String(data.gptPrompt ?? "").trim();
}
