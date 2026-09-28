export {
  PERF_DURATION_THRESHOLDS,
  PERF_RETENTION_DAYS,
  PERF_BATCH_LIMITS,
  PERF_COLLECTOR,
  classifyDurationMs,
} from "@/lib/performance/thresholds";
export type { PerfDurationClass } from "@/lib/performance/thresholds";
export type {
  PerfEventType,
  PerfEventInput,
  PerfEventRecord,
  PerfSessionTouch,
} from "@/lib/performance/types";
export {
  sanitizeRoute,
  sanitizeMetadata,
  sanitizeEvent,
  sanitizeEventBatch,
  metadataContainsSensitiveKeys,
} from "@/lib/performance/sanitize";
