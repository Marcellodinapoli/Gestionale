/**
 * Soglie durata (ms) — uniche per classificazione report.
 * Non influenzano il comportamento runtime dell'app.
 */
export const PERF_DURATION_THRESHOLDS = {
  /** sotto: normale */
  attenzione: 1_000,
  /** sotto: attenzione; sopra: lento */
  lento: 3_000,
  /** sopra: molto lento */
  moltoLento: 8_000,
} as const;

export type PerfDurationClass =
  | "normale"
  | "attenzione"
  | "lento"
  | "molto_lento";

export function classifyDurationMs(
  durationMs: number | null | undefined,
  thresholds = PERF_DURATION_THRESHOLDS
): PerfDurationClass | null {
  if (durationMs == null || !Number.isFinite(durationMs) || durationMs < 0) {
    return null;
  }
  if (durationMs >= thresholds.moltoLento) return "molto_lento";
  if (durationMs >= thresholds.lento) return "lento";
  if (durationMs >= thresholds.attenzione) return "attenzione";
  return "normale";
}

/** Retention consigliata (giorni). Job automatico non ancora collegato. */
export const PERF_RETENTION_DAYS = 14;

/** Limiti payload ingest. */
export const PERF_BATCH_LIMITS = {
  maxEventsPerRequest: 50,
  maxMetadataKeys: 12,
  maxStringLen: 400,
  maxRouteLen: 200,
  maxNameLen: 120,
} as const;

/** Client collector. */
export const PERF_COLLECTOR = {
  flushIntervalMs: 8_000,
  maxBatchSize: 25,
  inactivityEndMs: 30 * 60_000,
  storageKey: "credixa_perf_sid",
  headerSession: "x-credixa-perf-session",
} as const;
