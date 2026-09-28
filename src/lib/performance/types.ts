import type { PerfDurationClass } from "@/lib/performance/thresholds";

export type PerfEventType =
  | "PAGE"
  | "DWELL"
  | "ACTION"
  | "API"
  | "QUERY"
  | "ERROR"
  | "SESSION";

export type PerfEventInput = {
  type: PerfEventType;
  timestamp?: string;
  route?: string | null;
  action?: string | null;
  name?: string | null;
  durationMs?: number | null;
  status?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type PerfEventRecord = PerfEventInput & {
  sessionId: string;
  tenantId: string;
  durationClass?: PerfDurationClass | null;
};

export type PerfSessionTouch = {
  sessionId: string;
  tenantId: string;
  userId?: string | null;
  userRole?: string | null;
  userAgent?: string | null;
  ended?: boolean;
};
