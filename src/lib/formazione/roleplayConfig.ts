export {
  ROLEPLAY_COLLECTION,
  ROLEPLAY_PROMPT_FIELD,
  ROLEPLAY_LEGACY_GPT_PROMPT_FIELD,
  ROLEPLAY_AI_PROVIDER_FIELD,
  ROLEPLAY_DIFFICULTY_FIELD,
  ROLEPLAY_PERSONALITY_FIELD,
  ROLEPLAY_AI_PROVIDER_OPENAI,
  ROLEPLAY_AI_PROVIDER_REALTIME,
  ROLEPLAY_DEFAULT_AI_PROVIDER,
  ROLEPLAY_DIFFICULTIES,
  ROLEPLAY_PERSONALITIES,
  ROLEPLAY_DEFAULT_DIFFICULTY,
  ROLEPLAY_DEFAULT_PERSONALITY,
  DEFAULT_SIMULATION_PROMPT,
  resolveDifficulty,
  resolvePersonality,
  difficultyLabel,
  personalityLabel,
  behaviorContextBlock,
  resolveSimulationPrompt,
  resolveStoredSimulationPrompt,
  resolveAiProvider,
} from "@/lib/formazione/roleplayConfigCore";

export type { PracticeDataRow } from "@/lib/formazione/roleplayPracticeData";
export {
  parsePracticeData,
  practiceDataForDisplay,
  normalizePracticeData,
} from "@/lib/formazione/roleplayPracticeData";
