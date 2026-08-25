export {
  ROLEPLAY_DIFFICULTIES,
  ROLEPLAY_PERSONALITIES,
  resolveDifficulty,
  resolvePersonality,
  difficultyLabel,
  personalityLabel,
  resolveSimulationPrompt,
} from "@/lib/formazione/roleplayConfigCore";

export type { PracticeDataRow } from "@/lib/formazione/roleplayPracticeData";
export {
  parsePracticeData,
  practiceDataForDisplay,
  normalizePracticeData,
} from "@/lib/formazione/roleplayPracticeData";
