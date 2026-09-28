import "server-only";
import { isPerfMonitoringEnabled } from "@/lib/performance/enabled";
import { insertPerfEvents } from "@/lib/performance/repo";
import { sanitizeRoute } from "@/lib/performance/sanitize";
import type { PerfEventInput } from "@/lib/performance/types";

/**
 * Contesto opzionale per misurazioni server-side.
 * Se monitoring OFF o sessionId assente → no-op (overhead minimo).
 */
export type PerfServerContext = {
  tenantId: string;
  sessionId: string | null;
};

function createHashName(label: string): string {
  // Nome logico corto, senza SQL/parametri.
  const clean = label.replace(/\s+/g, " ").trim().slice(0, 80);
  return clean || "query";
}

/**
 * Misura un'operazione server (API/action). Non blocca su errori di persistenza.
 */
export async function measurePerfOperation<T>(
  ctx: PerfServerContext,
  opts: {
    type?: "API" | "ACTION" | "QUERY";
    name: string;
    route?: string | null;
    action?: string | null;
  },
  fn: () => Promise<T>
): Promise<T> {
  const sessionId = ctx.sessionId?.trim() || null;
  if (!sessionId) return fn();

  let enabled = false;
  try {
    enabled = await isPerfMonitoringEnabled(ctx.tenantId);
  } catch {
    enabled = false;
  }
  if (!enabled) return fn();

  const started = Date.now();
  let status: string = "ok";
  try {
    const result = await fn();
    return result;
  } catch (err) {
    status = "error";
    throw err;
  } finally {
    const durationMs = Date.now() - started;
    const event: PerfEventInput = {
      type: opts.type || "API",
      name: createHashName(opts.name),
      route: sanitizeRoute(opts.route),
      action: opts.action ?? null,
      durationMs,
      status,
      timestamp: new Date().toISOString(),
    };
    void insertPerfEvents({
      tenantId: ctx.tenantId,
      sessionId,
      events: [event],
    }).catch(() => {
      /* non bloccare */
    });
  }
}

/**
 * Wrapper query Neon monitorabile: passa un nome logico (mai SQL con valori).
 */
export async function measurePerfQuery<T>(
  ctx: PerfServerContext,
  logicalName: string,
  fn: () => Promise<T>,
  opts?: { rowCount?: (result: T) => number | null }
): Promise<T> {
  const sessionId = ctx.sessionId?.trim() || null;
  if (!sessionId) return fn();

  let enabled = false;
  try {
    enabled = await isPerfMonitoringEnabled(ctx.tenantId);
  } catch {
    enabled = false;
  }
  if (!enabled) return fn();

  const started = Date.now();
  let status: string = "ok";
  let rows: number | null = null;
  try {
    const result = await fn();
    if (opts?.rowCount) {
      try {
        rows = opts.rowCount(result);
      } catch {
        rows = null;
      }
    }
    return result;
  } catch (err) {
    status = "error";
    throw err;
  } finally {
    const durationMs = Date.now() - started;
    void insertPerfEvents({
      tenantId: ctx.tenantId,
      sessionId,
      events: [
        {
          type: "QUERY",
          name: createHashName(logicalName),
          durationMs,
          status,
          timestamp: new Date().toISOString(),
          metadata: rows != null ? { rowCount: rows } : null,
        },
      ],
    }).catch(() => {
      /* non bloccare */
    });
  }
}

/** Estrae sessionId dal header client (non autoritativo per tenant). */
export function perfSessionIdFromHeaders(
  headers: Headers | { get(name: string): string | null }
): string | null {
  const raw =
    headers.get("x-credixa-perf-session") ||
    headers.get("X-Credixa-Perf-Session");
  const s = String(raw || "").trim();
  if (!s || s.length > 80) return null;
  if (!/^[a-zA-Z0-9_-]+$/.test(s)) return null;
  return s;
}
