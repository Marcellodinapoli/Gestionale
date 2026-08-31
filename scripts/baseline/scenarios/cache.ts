import { globalMetrics } from "../lib/metrics";
import { measureHomeSharedBatch } from "./home";
import type { SessionUser } from "@/lib/permissions";

/** Analisi cache ttl + request cache — misura run ripetuto senza modificare app. */
export const CACHE_ANALYSIS = {
  ttlCache: {
    file: "src/lib/firebase/ttlCache.ts",
    defaultTtlMs: 15_000,
    scope: "per-processo Node (istanza serverless)",
    sharedAcrossUsers: false,
    sharedAcrossInstances: false,
    maxEntriesBeforePurge: 500,
    whatIsCached: "Risultati loadCollection per tenant+model (suffix opzionale)",
    invalidation: "ttlInvalidateTenantModel / ttlInvalidateTenant su write",
  },
  requestCache: {
    file: "src/lib/firebase/requestCache.ts",
    scope: "per richiesta HTTP/RSC (React cache())",
    sharedAcrossUsers: false,
    whatIsCached: "Collection promises, doc getById, indici id→doc",
    note: "Nei benchmark script ogni scenario è isolato; in produzione deduplica query duplicate nello stesso render",
  },
} as const;

export async function measureCacheEffect(user: SessionUser) {
  globalMetrics.reset();

  const run1Start = performance.now();
  await measureHomeSharedBatch(user);
  const run1 = {
    durationMs: Math.round(performance.now() - run1Start),
    ...globalMetrics.summary(),
  };

  globalMetrics.reset();

  const run2Start = performance.now();
  await measureHomeSharedBatch(user);
  const run2 = {
    durationMs: Math.round(performance.now() - run2Start),
    ...globalMetrics.summary(),
  };

  const readsDelta =
    run1.estimatedFirestoreReads > 0
      ? Math.round(
          ((run1.estimatedFirestoreReads - run2.estimatedFirestoreReads) /
            run1.estimatedFirestoreReads) *
            100
        )
      : 0;

  return {
    run1,
    run2,
    ttlCacheLikelyHitOnRun2: run2.estimatedFirestoreReads < run1.estimatedFirestoreReads,
    readsReductionPercentRun2: readsDelta,
    interpretation:
      run2.estimatedFirestoreReads < run1.estimatedFirestoreReads
        ? "Secondo run più veloce: ttlCache (15s) riduce loadCollection nello stesso processo. Su Netlify ogni istanza ha cache separata e cold start la azzera."
        : "Nessun beneficio misurabile nel secondo run (tenant vuoto o cache request-level già attiva nel primo run).",
  };
}
