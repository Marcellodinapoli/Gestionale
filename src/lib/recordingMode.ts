export type RecordingMode = "continuous" | "manual";

export function normalizeRecordingMode(value?: string | null): RecordingMode {
  return value === "continuous" ? "continuous" : "manual";
}
