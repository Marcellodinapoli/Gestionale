/**
 * FASE I — E2E Import + Audit (firestore | connector)
 * Uso: npx tsx database/scripts/test-phase-i-e2e.mjs [firestore|connector]
 */
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, readFileSync } from "node:fs";

function loadEnvFile() {
  const envPath = join(dirname(fileURLToPath(import.meta.url)), "../../.env");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}

loadEnvFile();

const require = createRequire(import.meta.url);
const Module = require("module");
const origLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "server-only") return {};
  return origLoad.apply(this, arguments);
};

const provider = process.argv[2] === "connector" ? "connector" : "firestore";
process.env.DATABASE_PROVIDER = provider;

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

async function main() {
  console.log(`FASE I E2E — DATABASE_PROVIDER=${provider}`);

  let tenantId;
  let tenantSlug;
  let adminId;
  let adminName;
  let mandanteId;
  let mandanteCodice;

  if (provider === "connector") {
    const base = process.env.CONNECTOR_BASE_URL || "http://localhost:8443";
    const tenantRes = await fetch(`${base}/api/v1/tenants/demo/auth/tenant`);
    const tenantJson = await tenantRes.json();
    if (!tenantJson.tenant?.Id) throw new Error("tenant demo SQL non trovato");
    tenantId = tenantJson.tenant.Id;
    tenantSlug = "demo";
    const userRes = await fetch(`${base}/api/v1/internal/users/by-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenantId, email: "admin@gestionale.local" }),
    });
    const userJson = await userRes.json();
    if (!userJson.user?.Id) throw new Error("admin demo SQL non trovato");
    adminId = userJson.user.Id;
    adminName = userJson.user.Name ?? "Admin";
    const mandRes = await fetch(`${base}/api/v1/tenants/demo/mandanti/list`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ take: 1 }),
    });
    const mandJson = await mandRes.json();
    if (!mandJson.items?.[0]) throw new Error("mandante demo SQL non trovato");
    mandanteId = mandJson.items[0].Id ?? mandJson.items[0].id;
    mandanteCodice = mandJson.items[0].Codice ?? mandJson.items[0].codice ?? "TST";
  } else {
    const { prisma } = await import(pathToFileURL(join(root, "src/lib/prisma.ts")).href);
    const tenant = await prisma.tenant.findFirst({ where: { slug: "demo" } });
    if (!tenant) throw new Error("tenant demo non trovato");
    tenantId = tenant.id;
    tenantSlug = tenant.slug;
    const admin = await prisma.user.findFirst({
      where: { tenantId: tenant.id, email: "admin@gestionale.local" },
    });
    if (!admin) throw new Error("admin demo non trovato");
    adminId = admin.id;
    adminName = admin.name;
    const mandante = await prisma.mandante.findFirst({ where: { tenantId: tenant.id } });
    if (!mandante) throw new Error("mandante demo non trovato");
    mandanteId = mandante.id;
    mandanteCodice = mandante.codice;
  }

  const { importBatchRepo } = await import(
    pathToFileURL(join(root, "src/lib/importBatchRepo.ts")).href
  );
  const { appendAudit } = await import(pathToFileURL(join(root, "src/lib/auditRepo.ts")).href);
  const { initPraticheImportBatch, processPraticheImportChunk, finalizePraticheImport } =
    await import(pathToFileURL(join(root, "src/lib/importPraticheBatch.ts")).href);

  const lotto = `E2E-${provider}-${Date.now()}`;
  const dbCtx = { tenantId, tenantSlug };

  const ctx = await initPraticheImportBatch({
    tenantId,
    tenantSlug,
    userId: adminId,
    userName: adminName,
    mandanteId,
    mandanteCodice,
    perimetro: "E2E",
    lotto,
    affidoIl: new Date(),
    scadenzaMandato: null,
    fileName: "e2e.csv",
  });

  const header = [
    "nome",
    "cognome",
    "cf",
    "lotto",
    "capitale",
    "mora",
    "spese",
    "spese_di_recupero",
    "debito_residuo",
    "netto_da_pagare",
    "stato",
  ];
  const ts = Date.now();
  const lines = [
    `Mario;Rossi;RSSMRA${String(ts).slice(-6)}A01F205X;${lotto};100;0;0;0;100;100;AFFIDATA`,
    `Luigi;Verdi;VRDLGU${String(ts).slice(-6)}B02F205Y;${lotto};200;0;0;0;200;200;AFFIDATA`,
  ];

  const chunk = await processPraticheImportChunk({
    tenantId,
    tenantSlug,
    ctx,
    header,
    delim: ";",
    lines,
  });
  if (chunk.created !== 2) throw new Error(`chunk: attese 2 create, got ${chunk.created}`);

  const fin = await finalizePraticheImport({
    tenantId,
    tenantSlug,
    userId: adminId,
    ctx,
    totals: { created: chunk.created, updated: 0, skipped: chunk.skipped },
    maxScadenzaCsv: null,
  });
  if (fin.totale < 2) throw new Error(`finalize: totale ${fin.totale}`);

  await appendAudit({
    userId: adminId,
    action: `e2e_${provider}`,
    entity: "importBatch",
    entityId: ctx.batchId,
    dettaglio: "test E2E userId-only context",
  });

  const repo = importBatchRepo(dbCtx);
  const batch = await repo.getById(tenantSlug, tenantId, ctx.batchId);
  if (!batch || batch.nPratiche < 2) throw new Error("batch non aggiornato");

  console.log(`✓ import 2 pratiche lotto ${lotto}`);
  console.log(`✓ audit append (userId-only) e2e_${provider}`);
  console.log(`✅ E2E ${provider} OK`);
}

main().catch((e) => {
  console.error("❌", e instanceof Error ? e.message : e);
  process.exit(1);
});
