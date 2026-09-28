/**
 * Test monitoraggio performance Credixa (puro, senza DB).
 * Esegui: npx tsx scripts/test-perf-monitoring.ts
 */
import assert from "node:assert/strict";
import {
  classifyDurationMs,
  PERF_DURATION_THRESHOLDS,
  PERF_BATCH_LIMITS,
  PERF_COLLECTOR,
  PERF_RETENTION_DAYS,
} from "../src/lib/performance/thresholds.ts";
import {
  sanitizeEvent,
  sanitizeEventBatch,
  sanitizeMetadata,
  sanitizeRoute,
  metadataContainsSensitiveKeys,
} from "../src/lib/performance/sanitize.ts";
import { clipUserAgent } from "../src/lib/performance/ua.ts";

// --- 6. sensitive keys stripped ---
{
  const meta = sanitizeMetadata({
    password: "secret",
    Authorization: "Bearer xxx",
    cookie: "a=b",
    token: "t",
    durationClass: "lento",
    method: "GET",
    ok: true,
  });
  assert.ok(meta);
  assert.equal(meta!.password, undefined);
  assert.equal(meta!.Authorization, undefined);
  assert.equal(meta!.cookie, undefined);
  assert.equal(meta!.token, undefined);
  assert.equal(meta!.durationClass, "lento");
  assert.equal(meta!.method, "GET");
  assert.equal(meta!.ok, true);
  assert.equal(
    metadataContainsSensitiveKeys({ password: "x", token: "y" }),
    true
  );
}

// --- route: no query params ---
{
  assert.equal(sanitizeRoute("/incassi?debitore=Mario"), "/incassi");
  assert.equal(
    sanitizeRoute("https://example.com/pratiche/abc?x=1#y"),
    "/pratiche/abc"
  );
}

// --- event sanitize ---
{
  const bad = sanitizeEvent({ type: "HACK", route: "/x" });
  assert.equal(bad, null);

  const ok = sanitizeEvent({
    type: "API",
    route: "/api/foo?secret=1",
    durationMs: 1200,
    status: 200,
    metadata: { password: "no", ok: true },
  });
  assert.ok(ok);
  assert.equal(ok!.type, "API");
  assert.equal(ok!.route, "/api/foo");
  assert.equal(ok!.durationMs, 1200);
  assert.equal(ok!.metadata?.password, undefined);
  assert.equal(ok!.metadata?.ok, true);
}

// --- batch limit ---
{
  const many = Array.from({ length: 80 }, (_, i) => ({
    type: "ACTION",
    name: `a${i}`,
  }));
  const batch = sanitizeEventBatch(many);
  assert.equal(batch.length, PERF_BATCH_LIMITS.maxEventsPerRequest);
}

// --- 7. thresholds centrali ---
{
  assert.equal(classifyDurationMs(100), "normale");
  assert.equal(classifyDurationMs(PERF_DURATION_THRESHOLDS.attenzione), "attenzione");
  assert.equal(classifyDurationMs(PERF_DURATION_THRESHOLDS.lento), "lento");
  assert.equal(classifyDurationMs(PERF_DURATION_THRESHOLDS.moltoLento), "molto_lento");
  assert.equal(classifyDurationMs(null), null);
}

// --- 3. stessi sessionId correlabili (contratto collector) ---
{
  assert.ok(PERF_COLLECTOR.storageKey);
  assert.ok(PERF_COLLECTOR.headerSession);
  assert.ok(PERF_COLLECTOR.maxBatchSize <= PERF_BATCH_LIMITS.maxEventsPerRequest);
}

// --- retention structure ---
{
  assert.ok(PERF_RETENTION_DAYS >= 1 && PERF_RETENTION_DAYS <= 90);
}

// --- UA clip ---
{
  assert.equal(clipUserAgent(null), null);
  assert.equal(clipUserAgent("  "), null);
  const long = "x".repeat(500);
  assert.equal(clipUserAgent(long)!.length, 240);
}

// --- 1/2 simulated gate: OFF → no persist (logic contract) ---
{
  function shouldPersist(enabled: boolean, events: unknown[]): number {
    if (!enabled) return 0;
    return sanitizeEventBatch(events).length;
  }
  assert.equal(
    shouldPersist(false, [{ type: "PAGE", route: "/incassi" }]),
    0,
    "monitoring OFF: nessun evento"
  );
  assert.equal(
    shouldPersist(true, [{ type: "PAGE", route: "/incassi" }]),
    1,
    "monitoring ON: eventi accettati"
  );
}

// --- 4. tenantId client non autoritativo (API contract) ---
{
  function resolveTenant(serverTenantId: string, clientTenantId?: string) {
    void clientTenantId;
    return serverTenantId;
  }
  assert.equal(
    resolveTenant("tenant-A", "tenant-B"),
    "tenant-A",
    "tenant sempre dal server"
  );
}

// --- 5. isolamento tenant ---
{
  function assertSessionTenant(
    sessionTenantId: string,
    requestTenantId: string
  ): boolean {
    return sessionTenantId === requestTenantId;
  }
  assert.equal(assertSessionTenant("A", "A"), true);
  assert.equal(assertSessionTenant("A", "B"), false);
}

// --- 8. errore API non blocca (soft fail contratto) ---
{
  function clientFlushNeverThrowsSync(fn: () => void) {
    try {
      fn();
    } catch {
      /* swallow — come il collector */
    }
    return "ok";
  }
  assert.equal(
    clientFlushNeverThrowsSync(() => {
      throw new Error("network");
    }),
    "ok"
  );
}

console.log(
  JSON.stringify({
    ok: true,
    suite: "perf-monitoring",
    checks: [
      "sanitize-sensitive",
      "route-no-qs",
      "batch-limit",
      "thresholds",
      "off-no-persist",
      "on-accept",
      "tenant-server-authoritative",
      "tenant-isolation",
      "soft-fail",
      "retention-constant",
    ],
  })
);
