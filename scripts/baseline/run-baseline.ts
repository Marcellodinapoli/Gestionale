import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { loadEnvFile } from "./lib/env";
import {
  extrapolatedStats,
  loadTenantStats,
  sizesMapFromStats,
  type TenantCollectionStats,
} from "./lib/firestoreSizes";
import { generateMarkdownReport } from "./generate-report";
import type { BaselineReport } from "./types";

/** Riferimento baseline extrapolated precedente (profilo 5k pratiche, offline). */
const EXTRAPOLATED_REFERENCE = {
  homePrismaCalls: 22,
  homeReads: 166_175,
  homeDurationMs: 6,
  mode: "extrapolated_offline",
};

async function main() {
  loadEnvFile();
  delete process.env.BASELINE_OFFLINE;

  const { globalMetrics } = await import("./lib/metrics");
  const { setCollectionSizes } = await import("./lib/instrumentedPrisma");
  const { loadFirstPraticaId, loadSessionUser, loadDemoUsersByRole } = await import(
    "./lib/loadUser"
  );
  const { measureHome } = await import("./scenarios/home");
  const { measureHomeForRole } = await import("./scenarios/homeByRole");
  const { measurePraticaOpen, measureLockOperations } = await import("./scenarios/pratica");
  const { measurePraticheList } = await import("./scenarios/praticheList");
  const { measureMemoAlerts } = await import("./scenarios/memoAlerts");
  const { CACHE_ANALYSIS, measureCacheEffect } = await import("./scenarios/cache");
  const { STATIC_FULL_SCAN_HOTSPOTS, summarizeFullScans } = await import("./scenarios/fullScans");
  const {
    buildTrafficMatrix,
    LOCK_HEARTBEAT_MS,
    MEMO_POLL_MS,
    SOFT_REFRESH_MS,
  } = await import("./scenarios/trafficTheory");
  const { measureHttpBaseline } = await import("./scenarios/http");
  type SessionUser = import("@/lib/permissions").SessionUser;

  async function runScenario<T>(fn: () => Promise<T>): Promise<T> {
    globalMetrics.reset();
    return fn();
  }

  async function measureHomeTimed(user: SessionUser) {
    const t0 = performance.now();
    await measureHome(user);
    return { totalDurationMs: Math.round(performance.now() - t0), ...globalMetrics.summary() };
  }

  let firebaseError: string | undefined;
  let stats: TenantCollectionStats;
  let adminUser: SessionUser;
  let praticaId: string | null = null;

  try {
    stats = await loadTenantStats("demo");
    adminUser = await loadSessionUser("demo", "admin@gestionale.local");
    praticaId = await loadFirstPraticaId(adminUser.tenantId);
  } catch (e) {
    console.error("Firebase non raggiungibile:", e);
    process.exit(1);
  }

  setCollectionSizes(sizesMapFromStats(stats));

  console.log("=== Credixa Baseline LIVE ===");
  console.log(`Tenant: demo (${stats.tenantId})`);
  console.log(`Documenti: ${stats.totalDocuments} | Pratiche: ${stats.collections.Pratica ?? 0}`);
  console.log("");

  // Home per ruolo
  console.log("[1] Home per ruolo...");
  const usersByRole = await loadDemoUsersByRole("demo");
  const homeByRole: BaselineReport["homeByRole"] = [];
  for (const [role, user] of Object.entries(usersByRole)) {
    if (!user) continue;
    console.log(`  → ${role} (${user.email})`);
    const result = await runScenario(() => measureHomeForRole(user));
    homeByRole.push(result);
  }

  // Home ADMIN completa (riferimento principale)
  console.log("[2] Home ADMIN (dettaglio)...");
  const home = await runScenario(() => measureHomeTimed(adminUser));

  // Extrapolated comparison @ same query pattern, scaled profile
  const scaledProfile = extrapolatedStats("medium", "demo");
  setCollectionSizes(sizesMapFromStats(scaledProfile));
  console.log("[2b] Stima reads @ profilo 5k pratiche (stesso codice)...");
  const homeAtScale = await runScenario(() => measureHomeTimed(adminUser));
  setCollectionSizes(sizesMapFromStats(stats));

  console.log("[3] Apertura pratica + lock...");
  let praticaOpen = null;
  let lockOps = null;
  if (praticaId) {
    praticaOpen = await runScenario(() => measurePraticaOpen(adminUser, praticaId));
    lockOps = await runScenario(() => measureLockOperations(adminUser, praticaId));
  }

  console.log("[4] Lista pratiche...");
  const operatorUser = usersByRole.OPERATOR ?? adminUser;
  const praticheDefault = await runScenario(() => measurePraticheList(operatorUser));
  const praticheImporto = await runScenario(() =>
    measurePraticheList(
      operatorUser,
      { stato: "IN_LAVORAZIONE", importoTotDa: "100" },
      { withAltriFiltriImporto: true }
    )
  );

  console.log("[5] Memo alerts...");
  const memoAlerts = await runScenario(() => measureMemoAlerts(operatorUser));

  console.log("[6] Cache (doppio run home)...");
  const cache = await measureCacheEffect(adminUser);

  console.log("[7] Full scan / aggregate / groupBy...");
  await runScenario(() => measureHome(adminUser));
  const fullScans = {
    dynamic: summarizeFullScans(
      globalMetrics.calls.filter((c) =>
        ["full_collection_scan", "aggregate", "groupBy", "count_fallback", "relation_prefetch"].includes(
          c.scanKind
        )
      )
    ),
    staticHotspots: STATIC_FULL_SCAN_HOTSPOTS,
  };

  const aggregateGroupBy = globalMetrics.calls.filter((c) =>
    ["aggregate", "groupBy"].includes(c.method)
  );

  const trafficTheory = buildTrafficMatrix(
    home.prismaCalls,
    homeAtScale.estimatedFirestoreReads
  );

  let http: BaselineReport["http"] = null;
  if (process.env.BASELINE_HTTP !== "0") {
    const baseUrl = process.env.BASELINE_HTTP_URL || "http://localhost:3001";
    console.log(`[8] HTTP TTFB (${baseUrl})...`);
    try {
      http = await measureHttpBaseline(baseUrl);
    } catch (e) {
      http = { loginOk: false, loginStatus: 0, routes: [], note: String(e) };
    }
  }

  const report: BaselineReport = {
    generatedAt: new Date().toISOString(),
    mode: "live",
    environment: {
      nodeVersion: process.version,
      operationalBackend: process.env.OPERATIONAL_BACKEND || "firebase",
      firebaseProject: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      firebaseError,
    },
    tenant: stats,
    readsProfile: scaledProfile,
    extrapolatedReference: EXTRAPOLATED_REFERENCE,
    comparison: {
      liveReads: home.estimatedFirestoreReads,
      scaledReads5k: homeAtScale.estimatedFirestoreReads,
      extrapolatedReads: EXTRAPOLATED_REFERENCE.homeReads,
      livePrismaCalls: home.prismaCalls,
      extrapolatedPrismaCalls: EXTRAPOLATED_REFERENCE.homePrismaCalls,
      liveDurationMs: home.totalDurationMs,
      extrapolatedDurationMs: EXTRAPOLATED_REFERENCE.homeDurationMs,
      readsPerPratica:
        stats.collections.Pratica && stats.collections.Pratica > 0
          ? Math.round(home.estimatedFirestoreReads / stats.collections.Pratica)
          : null,
    },
    user: {
      email: adminUser.email,
      role: adminUser.role,
      tenantSlug: adminUser.tenantSlug || "demo",
    },
    homeByRole,
    home,
    homeReadsAtScale: homeAtScale,
    pratica: { praticaId, open: praticaOpen, lockOps },
    praticheList: { default: praticheDefault, withImportoFiltri: praticheImporto },
    memoAlerts,
    cache,
    cacheAnalysis: CACHE_ANALYSIS,
    fullScans,
    aggregateGroupBy: aggregateGroupBy.map((c) => ({
      model: c.model,
      method: c.method,
      durationMs: c.durationMs,
      reads: c.estimatedReads,
      scanKind: c.scanKind,
      block: c.block,
    })),
    trafficTheory,
    http,
    constants: {
      lockHeartbeatMs: LOCK_HEARTBEAT_MS,
      lockTtlMs: 45_000,
      memoPollMs: MEMO_POLL_MS,
      softRefreshMs: SOFT_REFRESH_MS,
    },
  };

  const outDir = resolve(process.cwd(), "scripts/baseline/output");
  mkdirSync(outDir, { recursive: true });
  const stamp = report.generatedAt.replace(/[:.]/g, "-");
  writeFileSync(resolve(outDir, `baseline-live-${stamp}.json`), JSON.stringify(report, null, 2));
  writeFileSync(resolve(outDir, "baseline-latest.json"), JSON.stringify(report, null, 2));

  const md = generateMarkdownReport(report);
  writeFileSync(resolve(outDir, `baseline-live-${stamp}.md`), md);
  writeFileSync(resolve(outDir, "baseline-latest.md"), md);

  // Salva riferimento extrapolated se esiste report precedente
  const prevPath = resolve(outDir, "baseline-extrapolated-reference.json");
  if (!existsSync(prevPath)) {
    writeFileSync(prevPath, JSON.stringify(EXTRAPOLATED_REFERENCE, null, 2));
  }

  console.log("");
  console.log("=== Baseline LIVE completata ===");
  console.log(`Home ADMIN: ${home.prismaCalls} prisma, ${home.estimatedFirestoreReads} reads, ${home.totalDurationMs}ms`);
  console.log(`Home @ 5k (stima codice): ${homeAtScale.estimatedFirestoreReads} reads`);
  console.log(`Confronto extrapolated: ${EXTRAPOLATED_REFERENCE.homeReads} reads (offline)`);
  for (const r of homeByRole) {
    console.log(`  ${r.role}: ${r.prismaCalls} prisma, ${r.estimatedFirestoreReads} reads, ${r.totalDurationMs}ms`);
  }
  console.log("Report: scripts/baseline/output/baseline-latest.md");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
