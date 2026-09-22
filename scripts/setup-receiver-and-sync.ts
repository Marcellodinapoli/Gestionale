/**
 * Configura Receiver su Credixa + sync candidature per offerte PUBBLICATE.
 */
import { createRequire } from "node:module";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);
const serverOnlyPath = require.resolve("server-only");
require.cache[serverOnlyPath] = {
  id: serverOnlyPath,
  filename: serverOnlyPath,
  loaded: true,
  exports: {},
} as NodeModule;

function loadEnvFile(filePath: string) {
  if (!existsSync(filePath)) return;
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 0) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
}

loadEnvFile(path.resolve(".env"));
loadEnvFile(path.resolve("connector/.env"));

const TENANT = "2D9A1E28-CBE7-40B8-8D15-7807C28DC56F";
const BASE_URL =
  "https://entire-obtaining-remaining-conditioning.trycloudflare.com";

async function main() {
  const { upsertReceiverConfig, probeReceiverConfig, getReceiverConfig } =
    await import("../src/lib/recruiting/receiverRepo.ts");
  const { listOfferteLavoro, getOffertaLavoro } = await import(
    "../src/lib/recruiting/offerteRepo.ts"
  );
  const { syncIndeedApplicationsForOfferta } = await import(
    "../src/lib/recruiting/indeedApplySync.ts"
  );
  const { listApplications, getCvOpenUrl } = await import(
    "../src/lib/recruiting/receiverClient.ts"
  );
  const {
    findCandidaturaByExternalApplicationId,
    upsertCandidaturaFromReceiver,
    getCandidatura,
  } = await import("../src/lib/recruiting/candidatureRepo.ts");

  await upsertReceiverConfig(TENANT, {
    baseUrl: BASE_URL,
    sourceName: "receiver-local",
  });
  const probed = await probeReceiverConfig(TENANT);
  const cfg = await getReceiverConfig(TENANT);
  console.log(
    JSON.stringify(
      {
        config: {
          baseUrl: cfg?.baseUrl,
          status: cfg?.status,
          probedStatus: probed.status,
        },
      },
      null,
      2
    )
  );

  const offerte = await listOfferteLavoro(TENANT);
  const pubblicate = offerte.filter((o) => o.stato === "PUBBLICATA");
  const syncResults = [];
  for (const o of pubblicate) {
    const full = await getOffertaLavoro(TENANT, o.id);
    if (!full) continue;
    try {
      const result = await syncIndeedApplicationsForOfferta(
        {
          tenantId: TENANT,
          offertaId: o.id,
          userId: "script-setup-receiver",
        },
        {
          getOffertaLavoro,
          getReceiverConfig,
          listApplications,
          findByExternalApplicationId: findCandidaturaByExternalApplicationId,
          upsertFromReceiver: upsertCandidaturaFromReceiver,
          getCandidatura,
          getCvOpenUrl,
        }
      );
      syncResults.push({
        titolo: o.titolo,
        indeedJobId: full.indeedJobId,
        received: result.received,
        created: result.created,
        updated: result.updated,
        skipped: result.skipped,
        errors: result.errors,
        items: result.items.map((i) => ({
          applicationId: i.applicationId,
          outcome: i.outcome,
          code: i.code,
          message: i.message,
        })),
      });
    } catch (e) {
      syncResults.push({
        titolo: o.titolo,
        error: e instanceof Error ? e.message : String(e),
        code:
          e && typeof e === "object" && "code" in e
            ? (e as { code: string }).code
            : undefined,
      });
    }
  }

  console.log(JSON.stringify({ syncResults }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
