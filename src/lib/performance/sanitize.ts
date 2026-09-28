import { PERF_BATCH_LIMITS } from "@/lib/performance/thresholds";
import type { PerfEventInput, PerfEventType } from "@/lib/performance/types";

const SENSITIVE_KEY =
  /pass(word)?|token|secret|authorization|cookie|credential|cv\b|codice.?fiscale|cf\b|iban|pan|card|debitore|pratica|payload|body|response/i;

const ALLOWED_TYPES = new Set<PerfEventType>([
  "PAGE",
  "DWELL",
  "ACTION",
  "API",
  "QUERY",
  "ERROR",
  "SESSION",
]);

function clip(value: unknown, max: number): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s) return null;
  return s.length > max ? s.slice(0, max) : s;
}

/** Rimuove query string e frammenti; tiene solo path. */
export function sanitizeRoute(raw: unknown): string | null {
  const s = clip(raw, PERF_BATCH_LIMITS.maxRouteLen * 2);
  if (!s) return null;
  try {
    if (s.startsWith("http://") || s.startsWith("https://")) {
      const u = new URL(s);
      return clip(u.pathname, PERF_BATCH_LIMITS.maxRouteLen);
    }
  } catch {
    /* fallthrough */
  }
  const pathOnly = s.split("?")[0]?.split("#")[0] ?? s;
  return clip(pathOnly, PERF_BATCH_LIMITS.maxRouteLen);
}

export function sanitizeMetadata(
  raw: Record<string, unknown> | null | undefined
): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object") return null;
  const out: Record<string, unknown> = {};
  let n = 0;
  for (const [key, value] of Object.entries(raw)) {
    if (n >= PERF_BATCH_LIMITS.maxMetadataKeys) break;
    if (SENSITIVE_KEY.test(key)) continue;
    if (value == null) continue;
    if (typeof value === "string") {
      const c = clip(value, PERF_BATCH_LIMITS.maxStringLen);
      if (c) {
        out[key] = c;
        n += 1;
      }
      continue;
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      out[key] = value;
      n += 1;
      continue;
    }
    if (typeof value === "boolean") {
      out[key] = value;
      n += 1;
      continue;
    }
  }
  return Object.keys(out).length ? out : null;
}

export function sanitizeEvent(raw: unknown): PerfEventInput | null {
  if (!raw || typeof raw !== "object") return null;
  const e = raw as Record<string, unknown>;
  const type = String(e.type || "").toUpperCase() as PerfEventType;
  if (!ALLOWED_TYPES.has(type)) return null;

  let durationMs: number | null = null;
  if (e.durationMs != null && e.durationMs !== "") {
    const n = Number(e.durationMs);
    if (Number.isFinite(n) && n >= 0 && n < 3_600_000) {
      durationMs = Math.round(n);
    }
  }

  let timestamp: string | undefined;
  if (typeof e.timestamp === "string" && e.timestamp) {
    const t = Date.parse(e.timestamp);
    if (Number.isFinite(t)) timestamp = new Date(t).toISOString();
  }

  const metaRaw =
    e.metadata && typeof e.metadata === "object"
      ? (e.metadata as Record<string, unknown>)
      : null;

  return {
    type,
    timestamp,
    route: sanitizeRoute(e.route),
    action: clip(e.action, PERF_BATCH_LIMITS.maxNameLen),
    name: clip(e.name, PERF_BATCH_LIMITS.maxNameLen),
    durationMs,
    status: clip(e.status, 40),
    metadata: sanitizeMetadata(metaRaw),
  };
}

export function sanitizeEventBatch(raw: unknown): PerfEventInput[] {
  if (!Array.isArray(raw)) return [];
  const out: PerfEventInput[] = [];
  for (const item of raw.slice(0, PERF_BATCH_LIMITS.maxEventsPerRequest)) {
    const e = sanitizeEvent(item);
    if (e) out.push(e);
  }
  return out;
}

/** True se un oggetto grezzo contiene chiavi sensibili (per test). */
export function metadataContainsSensitiveKeys(
  raw: Record<string, unknown> | null | undefined
): boolean {
  if (!raw) return false;
  return Object.keys(raw).some((k) => SENSITIVE_KEY.test(k));
}
