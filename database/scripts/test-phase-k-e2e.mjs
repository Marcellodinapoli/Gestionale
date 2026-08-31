/**
 * FASE K — E2E audit (connector | firestore)
 * Uso: npx tsx database/scripts/test-phase-k-e2e.mjs [connector|firestore]
 */
import { createRequire } from "node:module";
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

const provider = process.argv[2] === "firestore" ? "firestore" : "connector";
process.env.DATABASE_PROVIDER = provider;

const results = [];

function pass(name) {
  results.push({ name, ok: true });
  console.log(`  ✓ ${name}`);
}

function fail(name, err) {
  results.push({ name, ok: false, error: String(err) });
  console.error(`  ✗ ${name}:`, err);
}

async function main() {
  console.log(`\nFASE K E2E — DATABASE_PROVIDER=${provider}\n`);

  const { isConnectorProvider } = await import("../../src/lib/data/factory.ts");
  if (isConnectorProvider() !== (provider === "connector")) {
    throw new Error(`Provider mismatch: expected ${provider}`);
  }
  pass("provider config");

  if (provider === "connector") {
    const base = process.env.CONNECTOR_BASE_URL || "http://localhost:8443";
    const health = await fetch(`${base}/health`);
    if (!health.ok) throw new Error("connector health failed");
    pass("connector health");

    const tenantRes = await fetch(`${base}/api/v1/tenants/demo/auth/tenant`);
    const tenantJson = await tenantRes.json();
    const tenantId = tenantJson.tenant?.Id;
    if (!tenantId) throw new Error("demo tenant missing");
    pass("login tenant demo");

    const userRes = await fetch(`${base}/api/v1/internal/users/by-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenantId, email: "admin@gestionale.local" }),
    });
    const userJson = await userRes.json();
    if (!userJson.user?.Id) throw new Error("admin user missing");
    pass("user session lookup");

    const dashRes = await fetch(`${base}/api/v1/tenants/demo/dashboard/home`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: userJson.user.Id,
        role: userJson.user.Role ?? "ADMIN",
        lavorateDate: new Date().toISOString().slice(0, 10),
        scope: { mode: "tenant" },
        incassiScope: "tenant",
        includeAdmin: true,
        includeAmministrazione: false,
        vistaGruppoLavorate: false,
      }),
    });
    if (!dashRes.ok) throw new Error(`dashboard home ${dashRes.status}`);
    pass("Home KPI dashboard");

    const prRes = await fetch(`${base}/api/v1/tenants/demo/pratiche/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ page: 1, pageSize: 5 }),
    });
    const prJson = await prRes.json();
    if (!prRes.ok) throw new Error(`pratiche search ${prRes.status}`);
    pass(`lista pratiche (${prJson.total ?? 0} totali)`);

    if (prJson.items?.[0]) {
      const id = prJson.items[0].Id ?? prJson.items[0].id;
      const det = await fetch(`${base}/api/v1/tenants/demo/pratiche/${id}`);
      if (!det.ok) throw new Error("pratica detail failed");
      pass("apertura pratica");
    }

    for (const path of ["sedi/list", "postazioni/list", "users/list", "configurazione/list"]) {
      const r = await fetch(`${base}/api/v1/tenants/demo/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ take: 1 }),
      });
      if (!r.ok) throw new Error(`${path} → ${r.status}`);
    }
    pass("operatori/sedi/postazioni/configurazione");

    const provRes = await fetch(`${base}/api/v1/tenants/demo/provvigioni/list`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ take: 1 }),
    });
    if (!provRes.ok) throw new Error("provvigioni list failed");
    pass("provvigioni");

    const regRes = await fetch(`${base}/api/v1/tenants/demo/registrazioni/list`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ take: 1 }),
    });
    if (!regRes.ok) throw new Error("registrazioni list failed");
    pass("registrazioni");

    const auditRes = await fetch(`${base}/api/v1/tenants/demo/audit/list`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ take: 1 }),
    });
    if (!auditRes.ok) throw new Error("audit list failed");
    pass("audit");

    const ibRes = await fetch(`${base}/api/v1/tenants/demo/import-batch/list`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ take: 1 }),
    });
    if (!ibRes.ok) throw new Error("import-batch list failed");
    pass("import");

    const pwdCtx = await fetch(
      `${base}/api/v1/internal/users/${userJson.user.Id}/password-context`
    );
    if (!pwdCtx.ok) throw new Error("password-context failed");
    pass("passwordHistory SQL");
  } else {
    const { prisma } = await import("../../src/lib/prisma.ts");
    const tenant = await prisma.tenant.findFirst({ where: { slug: "demo" } });
    if (!tenant) throw new Error("demo tenant firestore missing");
    pass("firestore tenant demo");

    const user = await prisma.user.findFirst({
      where: { tenantId: tenant.id, email: "admin@gestionale.local" },
    });
    if (!user) throw new Error("admin firestore missing");
    pass("firestore user lookup");

    const pratiche = await prisma.pratica.count({ where: { tenantId: tenant.id } });
    pass(`firestore pratiche count (${pratiche})`);

    const sedi = await prisma.sede.count({ where: { tenantId: tenant.id } });
    pass(`firestore sedi count (${sedi})`);

    const mandanti = await prisma.mandante.count({ where: { tenantId: tenant.id } });
    pass(`firestore mandanti count (${mandanti})`);
  }

  const { loadHomeKpiAuto } = await import("../../src/lib/homeKpi/loadHomeKpi.ts");
  pass("homeKpi module load");

  const failed = results.filter((r) => !r.ok);
  console.log(`\nFASE K E2E ${provider}: ${results.length - failed.length}/${results.length} PASS`);
  if (failed.length) {
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("FASE K E2E FAIL", e);
  process.exit(1);
});
