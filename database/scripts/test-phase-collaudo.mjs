/**
 * COLLAUDO FINALE — gestionale completo (connector | firestore smoke)
 * Uso: npx tsx database/scripts/test-phase-collaudo.mjs [connector|firestore|all]
 */
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, readFileSync } from "node:fs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const BASE = process.env.CONNECTOR_BASE_URL || "http://localhost:8443";
const mode = process.argv[2] || "all";

function loadEnv() {
  const envPath = join(ROOT, ".env");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}
loadEnv();

const suite = [];
function record(area, name, ok, detail = "", ms = 0) {
  suite.push({ area, name, ok, detail, ms });
  const icon = ok ? "✓" : "✗";
  const timing = ms ? ` (${ms}ms)` : "";
  console.log(`  ${icon} [${area}] ${name}${timing}${detail ? ` — ${detail}` : ""}`);
}

async function req(method, path, body) {
  const t0 = performance.now();
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const ms = Math.round(performance.now() - t0);
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json, ms };
}

async function runScript(label, scriptPath, args = []) {
  return new Promise((resolve) => {
    const t0 = performance.now();
    const child = spawn("npx", ["tsx", scriptPath, ...args], {
      cwd: ROOT,
      env: { ...process.env, DATABASE_PROVIDER: args[0] === "firestore" ? "firestore" : "connector" },
      shell: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("close", (code) => {
      const ms = Math.round(performance.now() - t0);
      resolve({ label, ok: code === 0, ms, out, err, code });
    });
  });
}

function stubServerOnly() {
  const require = createRequire(import.meta.url);
  const Module = require("module");
  const orig = Module._load;
  Module._load = function (r, p, m) {
    if (r === "server-only") return {};
    return orig.apply(this, arguments);
  };
}

async function connectorCollaudo() {
  console.log("\n═══ COLLAUDO CONNECTOR ═══\n");
  process.env.DATABASE_PROVIDER = "connector";

  const health = await req("GET", "/health");
  record("Infra", "Connector health", health.status === 200, `HTTP ${health.status}`, health.ms);

  stubServerOnly();
  try {
    const { authenticateLogin } = await import("../../src/lib/loginCore.ts");
    const t0 = performance.now();
    const loginAdmin = await authenticateLogin({
      email: "admin@gestionale.local",
      password: "Demo123!",
      tenantSlug: "demo",
    });
    record(
      "1.Login",
      "Login ADMIN demo",
      !("error" in loginAdmin),
      "error" in loginAdmin ? loginAdmin.error : loginAdmin.href ?? "ok",
      Math.round(performance.now() - t0)
    );

    const loginOp = await authenticateLogin({
      email: "op1@demo.local",
      password: "Demo123!",
      tenantSlug: "demo",
    });
    record(
      "1.Login",
      "Login OPERATOR demo",
      !("error" in loginOp),
      "error" in loginOp ? loginOp.error : "ok"
    );

    const badLogin = await authenticateLogin({
      email: "admin@gestionale.local",
      password: "wrong",
      tenantSlug: "demo",
    });
    record("1.Login", "Credenziali errate rifiutate", "error" in badLogin);
  } catch (e) {
    record("1.Login", "Login module", false, String(e));
  }

  const demoT = await req("GET", "/api/v1/tenants/demo/auth/tenant");
  const demoId = demoT.json.tenant?.Id;
  const adminU = await req("POST", "/api/v1/internal/users/by-email", {
    tenantId: demoId,
    email: "admin@gestionale.local",
  });
  const adminId = adminU.json.user?.Id;
  const opU = await req("POST", "/api/v1/internal/users/by-email", {
    tenantId: demoId,
    email: "op1@demo.local",
  });
  const opId = opU.json.user?.Id;

  const homeAdmin = await req("POST", "/api/v1/tenants/demo/dashboard/home", {
    userId: adminId,
    role: "ADMIN",
    lavorateDate: new Date().toISOString().slice(0, 10),
    scope: { mode: "tenant" },
    incassiScope: "tenant",
    includeAdmin: true,
    includeAmministrazione: true,
    vistaGruppoLavorate: false,
  });
  record("2.Home", "Home KPI ADMIN", homeAdmin.status === 200, `HTTP ${homeAdmin.status}`, homeAdmin.ms);

  const homeOp = await req("POST", "/api/v1/tenants/demo/dashboard/home", {
    userId: opId,
    role: "OPERATORE",
    lavorateDate: new Date().toISOString().slice(0, 10),
    scope: { mode: "operator", userId: opId },
    incassiScope: "user",
    includeAdmin: false,
    includeAmministrazione: false,
    vistaGruppoLavorate: false,
  });
  record("2.Home", "Home KPI OPERATOR", homeOp.status === 200, `HTTP ${homeOp.status}`, homeOp.ms);

  for (const [area, path] of [
    ["3.Sedi", "sedi"],
    ["4.Postazioni", "postazioni"],
    ["5.Operatori", "users"],
  ]) {
    const list = await req("POST", `/api/v1/tenants/demo/${path}/list`, { take: 10, includeCounts: true });
    const cnt = await req("POST", `/api/v1/tenants/demo/${path}/count`, {});
    record(area, "list + count demo", list.status === 200 && cnt.status === 200, `total ${cnt.json.total ?? "?"}`, list.ms);
    const alfaList = await req("POST", `/api/v1/tenants/alfa/${path}/list`, { take: 5 });
    record(area, "tenant isolation alfa", alfaList.status === 200);
  }

  const perfSearch = await req("POST", "/api/v1/tenants/demo/pratiche/search", {
    page: 1,
    pageSize: 25,
    filter: { stato: "IN_LAVORAZIONE" },
  });
  record(
    "6.Pratiche",
    "Ricerca dataset grande",
    perfSearch.status === 200,
    `${perfSearch.json.total ?? "?"} pratiche, queryMs ${perfSearch.json.queryMs ?? perfSearch.ms}`,
    perfSearch.json.queryMs ?? perfSearch.ms
  );

  const perfList = await req("POST", "/api/v1/tenants/demo/pratiche/list", {
    filter: { notStati: ["CHIUSA", "ARCHIVIATA"] },
    take: 50,
    page: 1,
    pageSize: 50,
  });
  record("6.Pratiche", "Lista paginata 50", perfList.status === 200, `total ${perfList.json.total}`, perfList.ms);

  const pList = await req("POST", "/api/v1/tenants/demo/pratiche/list", { take: 1 });
  if (pList.json.items?.[0]) {
    const pid = pList.json.items[0].Id ?? pList.json.items[0].id;
    const assegna = await req("POST", `/api/v1/tenants/demo/pratiche/${pid}/assign`, {
      assegnatarioId: opId,
      titolareId: opId,
      mode: "affida",
    });
    record("6.Pratiche", "Assegnazione", assegna.status === 200, `HTTP ${assegna.status}`, assegna.ms);
  }

  const gList = await req("POST", "/api/v1/tenants/demo/garanti/find-first", { filter: {} });
  record("7.Garanti", "find-first", gList.status === 200 || gList.status === 404, `HTTP ${gList.status}`);

  const prov = await req("POST", "/api/v1/tenants/demo/provvigioni/list", { take: 5 });
  const provAgg = await req("POST", "/api/v1/tenants/demo/provvigioni/aggregate", { filter: {} });
  record("12.Provvigioni", "list + aggregate", prov.status === 200 && provAgg.status === 200, "", prov.ms);

  const reg = await req("POST", "/api/v1/tenants/demo/registrazioni/list", { take: 5 });
  record("13.Registrazioni", "list", reg.status === 200, `rows ${reg.json.items?.length ?? 0}`, reg.ms);

  if (pList.json.items?.[0]) {
    const pid = pList.json.items[0].Id ?? pList.json.items[0].id;
    const fat = await req("POST", "/api/v1/tenants/demo/fatture/", {
      praticaId: pid,
      numero: `COL-${Date.now()}`,
      importo: 100,
      dataFattura: new Date().toISOString(),
      dataScadenza: new Date().toISOString(),
    });
    record("14.Contabile", "create fattura", fat.status === 201 || fat.status === 200, `HTTP ${fat.status}`);
    const doc = await req("POST", "/api/v1/tenants/demo/documenti/", {
      praticaId: pid,
      nome: "collaudo.pdf",
      tipo: "PDF",
    });
    record("14.Contabile", "create documento", doc.status === 201 || doc.status === 200, `HTTP ${doc.status}`);
    const rate = await req("POST", "/api/v1/tenants/demo/piano-rate/", {
      praticaId: pid,
      numeroRata: 99,
      importo: 50,
      scadenza: new Date().toISOString(),
    });
    record("14.Contabile", "create piano rata", rate.status === 201 || rate.status === 200, `HTTP ${rate.status}`);
  }

  const cfgKey = `collaudo.${Date.now()}`;
  const cfgUps = await req("POST", "/api/v1/tenants/demo/configurazione/upsert", { chiave: cfgKey, valore: "1" });
  const cfgGet = await req("GET", `/api/v1/tenants/demo/configurazione/${encodeURIComponent(cfgKey)}`);
  record("15.Configurazione", "upsert + get", cfgUps.status === 200 && cfgGet.status === 200, "", cfgGet.ms);

  const aud = await req("POST", "/api/v1/tenants/demo/audit/list", { take: 5, includeUser: true });
  const audAppend = await req("POST", "/api/v1/tenants/demo/audit/", {
    userId: adminId,
    action: "collaudo_test",
    entity: "system",
    dettaglio: "FASE COLLAUDO",
  });
  record("17.Audit", "list + append", aud.status === 200 && (audAppend.status === 200 || audAppend.status === 201 || audAppend.status === 204));

  const statLike = await req("POST", "/api/v1/tenants/demo/pratiche/list", {
    filter: {
      notStati: ["CHIUSA"],
      ...(opId ? { assegnatarioIdsIn: [opId] } : {}),
    },
    take: 100,
    include: ["mandante", "incassi", "importBatch"],
  });
  record(
    "18.Statistiche",
    "query pratiche filtrate",
    statLike.status === 200,
    `HTTP ${statLike.status}, rows ${statLike.json.items?.length ?? 0}`,
    statLike.ms
  );

  const affidiLike = await req("POST", "/api/v1/tenants/demo/pratiche/list", {
    filter: { hasAssegnatario: false, notStati: ["CHIUSA", "ARCHIVIATA"] },
    take: 20,
    include: ["debitore", "mandante"],
  });
  record("19.Affidi", "pratiche da affidare", affidiLike.status === 200, `count ${affidiLike.json.items?.length ?? 0}`, affidiLike.ms);

  const demoSede = await req("POST", "/api/v1/tenants/demo/sedi/list", { take: 1 });
  const demoSedeId = demoSede.json.items?.[0]?.id ?? demoSede.json.items?.[0]?.Id;
  if (demoSedeId) {
    const leak = await req("POST", "/api/v1/tenants/alfa/sedi/list", { filter: { id: demoSedeId } });
    const found = leak.json.items?.some((s) => (s.id ?? s.Id) === demoSedeId);
    record("Isolation", "demo sede non in alfa", leak.status === 200 && !found);
  }

  console.log("\n── Script di fase ──\n");
  const scripts = [
    ["6.Pratiche", "database/scripts/test-phase-c-pratiche.mjs"],
    ["7.Debitori", "database/scripts/test-phase-d-debitori-mandanti.mjs"],
    ["8-9.Incassi/Attivita", "database/scripts/test-phase-e-incassi-attivita.mjs"],
    ["10.Agenda", "database/scripts/test-phase-h-agenda.mjs"],
    ["11.Lock", "database/scripts/test-phase-g-lock.mjs"],
    ["16.Import/Audit", "database/scripts/test-phase-i-import-audit.mjs"],
    ["2.Home", "database/scripts/test-phase-f-dashboard.mjs"],
  ];
  for (const [area, rel] of scripts) {
    const r = await runScript(area, join(ROOT, rel));
    record(area, rel.split("/").pop(), r.ok, r.ok ? "" : (r.err || r.out).slice(-200), r.ms);
  }

  const kE2e = await runScript("E2E", join(ROOT, "database/scripts/test-phase-k-e2e.mjs"), ["connector"]);
  record("E2E", "test-phase-k-e2e", kE2e.ok, "", kE2e.ms);
}

async function firestoreSmoke() {
  console.log("\n═══ SMOKE FIRESTORE ═══\n");
  process.env.DATABASE_PROVIDER = "firestore";
  stubServerOnly();

  const r = await runScript("Firestore", join(ROOT, "database/scripts/test-phase-k-e2e.mjs"), ["firestore"]);
  record("Firestore", "test-phase-k-e2e", r.ok, "", r.ms);

  try {
    const { prisma } = await import("../../src/lib/prisma.ts");
    const tenant = await prisma.tenant.findFirst({ where: { slug: "demo" } });
    record("Firestore", "tenant demo", !!tenant);

    const { authenticateLogin } = await import("../../src/lib/loginCore.ts");
    const res = await authenticateLogin({
      email: "admin@gestionale.local",
      password: "Demo123!",
      tenantSlug: "demo",
    });
    record("Firestore", "login ADMIN", !("error" in res), "error" in res ? res.error : "ok");

    const pratiche = await prisma.pratica.count({ where: { tenantId: tenant?.id } });
    record("Firestore", "pratiche count", pratiche >= 0, String(pratiche));
    const mandanti = await prisma.mandante.count({ where: { tenantId: tenant?.id } });
    record("Firestore", "mandanti count", mandanti >= 0, String(mandanti));
    const incassi = await prisma.incasso.count({ where: { tenantId: tenant?.id } });
    record("Firestore", "incassi count", incassi >= 0, String(incassi));
  } catch (e) {
    record("Firestore", "moduli app", false, String(e));
  }
}

async function main() {
  console.log("COLLAUDO FINALE —", new Date().toISOString());
  if (mode === "connector" || mode === "all") await connectorCollaudo();
  if (mode === "firestore" || mode === "all") await firestoreSmoke();

  const passed = suite.filter((s) => s.ok).length;
  const failed = suite.filter((s) => !s.ok);
  console.log(`\n═══ RIEPILOGO: ${passed}/${suite.length} PASS ═══`);
  if (failed.length) {
    console.log("\nFAIL:");
    for (const f of failed) console.log(`  - [${f.area}] ${f.name}: ${f.detail}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("COLLAUDO ABORT:", e);
  process.exit(1);
});
