import "server-only";
import { isNeonConfigured } from "@/lib/neon/client";
import { neonQuery } from "@/lib/neon/pool";
import { PLATFORM_PERF_UNTIL_KEY } from "@/lib/platform/tenantProfile";

const cache = new Map<string, { value: boolean; until: number }>();
const CACHE_MS = 5_000;

export type PerfMonitoringState = {
  enabled: boolean;
  /** ISO UTC scadenza; null = illimitato (se enabled). */
  until: string | null;
  /** true se enabled e non scaduto. */
  active: boolean;
};

async function readFlag(tenantId: string): Promise<boolean> {
  const rows = await neonQuery<{ PerfMonitoringEnabled: boolean }>(
    `SELECT "PerfMonitoringEnabled" FROM "Tenants" WHERE "Id" = $1::uuid LIMIT 1`,
    [tenantId]
  );
  return Boolean(rows[0]?.PerfMonitoringEnabled);
}

async function readUntilIso(tenantId: string): Promise<string | null> {
  const rows = await neonQuery<{ Valore: string }>(
    `SELECT "Valore" FROM "ConfigurazioneSistema"
     WHERE "TenantId" = $1::uuid AND "Chiave" = $2 LIMIT 1`,
    [tenantId, PLATFORM_PERF_UNTIL_KEY]
  );
  const raw = String(rows[0]?.Valore ?? "").trim();
  if (!raw) return null;
  const t = Date.parse(raw);
  if (!Number.isFinite(t)) return null;
  return new Date(t).toISOString();
}

function isExpired(untilIso: string | null, now = Date.now()): boolean {
  if (!untilIso) return false;
  const t = Date.parse(untilIso);
  return Number.isFinite(t) && t <= now;
}

/**
 * Stato monitoraggio (flag + eventuale scadenza).
 * Se scaduto, spegne il flag su Neon (best-effort) e restituisce inactive.
 */
export async function getPerfMonitoringState(
  tenantId: string
): Promise<PerfMonitoringState> {
  const id = String(tenantId || "").trim();
  if (!id || !isNeonConfigured()) {
    return { enabled: false, until: null, active: false };
  }

  try {
    const [enabled, until] = await Promise.all([
      readFlag(id),
      readUntilIso(id),
    ]);
    if (!enabled) return { enabled: false, until: null, active: false };

    if (isExpired(until)) {
      await deactivatePerfMonitoring(id).catch(() => undefined);
      return { enabled: false, until: null, active: false };
    }
    return { enabled: true, until, active: true };
  } catch {
    return { enabled: false, until: null, active: false };
  }
}

/**
 * Legge Tenants.PerfMonitoringEnabled (+ scadenza).
 * Cache breve in-process: con flag OFF evita query ripetute nello stesso processo.
 */
export async function isPerfMonitoringEnabled(tenantId: string): Promise<boolean> {
  const id = String(tenantId || "").trim();
  if (!id) return false;
  if (!isNeonConfigured()) return false;

  const hit = cache.get(id);
  const now = Date.now();
  if (hit && hit.until > now) return hit.value;

  try {
    const state = await getPerfMonitoringState(id);
    cache.set(id, { value: state.active, until: now + CACHE_MS });
    return state.active;
  } catch {
    cache.set(id, { value: false, until: now + 10_000 });
    return false;
  }
}

/** Invalida cache (test / update flag). */
export function clearPerfMonitoringEnabledCache(tenantId?: string) {
  if (tenantId) cache.delete(tenantId);
  else cache.clear();
}

/** Solo test: forza valore in cache. */
export function _setPerfMonitoringEnabledCacheForTests(
  tenantId: string,
  value: boolean
) {
  cache.set(tenantId, { value, until: Date.now() + CACHE_MS });
}

async function deactivatePerfMonitoring(tenantId: string): Promise<void> {
  await neonQuery(
    `UPDATE "Tenants" SET "PerfMonitoringEnabled" = false WHERE "Id" = $1::uuid`,
    [tenantId]
  );
  await neonQuery(
    `DELETE FROM "ConfigurazioneSistema"
     WHERE "TenantId" = $1::uuid AND "Chiave" = $2`,
    [tenantId, PLATFORM_PERF_UNTIL_KEY]
  );
  clearPerfMonitoringEnabledCache(tenantId);
}
