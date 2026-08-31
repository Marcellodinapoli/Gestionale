import type { CACHE_ANALYSIS } from "./scenarios/cache";
import type { STATIC_FULL_SCAN_HOTSPOTS } from "./scenarios/fullScans";
import type { globalMetrics } from "./lib/metrics";
import type { TenantCollectionStats } from "./lib/firestoreSizes";
import type { buildTrafficMatrix } from "./scenarios/trafficTheory";
import type { measureHttpBaseline } from "./scenarios/http";
import type { measurePraticaOpen, measureLockOperations } from "./scenarios/pratica";
import type { measurePraticheList } from "./scenarios/praticheList";
import type { measureMemoAlerts } from "./scenarios/memoAlerts";
import type { measureCacheEffect } from "./scenarios/cache";
import type { summarizeFullScans } from "./scenarios/fullScans";
import type { measureHomeForRole } from "./scenarios/homeByRole";

export type BaselineReport = {
  generatedAt: string;
  mode: "live" | "extrapolated";
  environment: {
    nodeVersion: string;
    operationalBackend: string;
    firebaseProject?: string;
    firebaseError?: string;
  };
  tenant: TenantCollectionStats;
  readsProfile?: TenantCollectionStats;
  extrapolatedReference?: {
    homePrismaCalls: number;
    homeReads: number;
    homeDurationMs: number;
    mode: string;
  };
  comparison?: {
    liveReads: number;
    scaledReads5k: number;
    extrapolatedReads: number;
    livePrismaCalls: number;
    extrapolatedPrismaCalls: number;
    liveDurationMs: number;
    extrapolatedDurationMs: number;
    readsPerPratica: number | null;
  };
  user: { email: string; role: string; tenantSlug: string };
  homeByRole?: Array<
    ReturnType<typeof globalMetrics.summary> & {
      role: string;
      email: string;
      totalDurationMs: number;
    }
  >;
  home: ReturnType<typeof globalMetrics.summary> & { totalDurationMs: number };
  homeReadsAtScale?: ReturnType<typeof globalMetrics.summary> & { totalDurationMs: number };
  pratica: {
    praticaId: string | null;
    open: Awaited<ReturnType<typeof measurePraticaOpen>> | null;
    lockOps: Awaited<ReturnType<typeof measureLockOperations>> | null;
  };
  praticheList: {
    default: Awaited<ReturnType<typeof measurePraticheList>>;
    withImportoFiltri: Awaited<ReturnType<typeof measurePraticheList>>;
  };
  memoAlerts: Awaited<ReturnType<typeof measureMemoAlerts>>;
  cache: Awaited<ReturnType<typeof measureCacheEffect>>;
  cacheAnalysis: typeof CACHE_ANALYSIS;
  fullScans: {
    dynamic: ReturnType<typeof summarizeFullScans>;
    staticHotspots: typeof STATIC_FULL_SCAN_HOTSPOTS;
  };
  aggregateGroupBy?: Array<{
    model: string;
    method: string;
    durationMs: number;
    reads: number;
    scanKind: string;
    block?: string;
  }>;
  trafficTheory: ReturnType<typeof buildTrafficMatrix>;
  http: Awaited<ReturnType<typeof measureHttpBaseline>> | null;
  constants: {
    lockHeartbeatMs: number;
    lockTtlMs: number;
    memoPollMs: number;
    softRefreshMs: number;
  };
};
