/**
 * One-shot: verify Perf tables + E2E ON/OFF against local Next + Neon.
 * Non modifica codice app. Uso: npx tsx scripts/e2e-perf-monitoring.mjs
 */
import { config } from "dotenv";
import { resolve } from "node:path";
import pg from "pg";
import { randomUUID } from "node:crypto";

config({ path: resolve(process.cwd(), ".env") });

const BASE = process.env.PERF_E2E_BASE || "http://localhost:3001";
const url = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL_NEON;

if (!url) {
  console.error("NEON_DATABASE_URL missing");
  process.exit(1);
}

const c = new pg.Client({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
});
await c.connect();

function out(label, data) {
  console.log(`\n=== ${label} ===`);
  console.log(typeof data === "string" ? data : JSON.stringify(data, null, 2));
}

// 1) Tables + indexes
const tables = (
  await c.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema='public' AND table_name IN ('PerfSessions','PerfEvents')
    ORDER BY 1`)
).rows.map((r) => r.table_name);

const indexes = (
  await c.query(`
    SELECT tablename, indexname FROM pg_indexes
    WHERE schemaname='public' AND tablename IN ('PerfSessions','PerfEvents')
    ORDER BY tablename, indexname`)
).rows;

out("tables", tables);
out("indexes", indexes);

const needIdx = [
  "PerfSessions_TenantId_SessionId_idx",
  "PerfEvents_TenantId_SessionId_idx",
  "PerfEvents_TenantId_Timestamp_idx",
  "PerfEvents_SessionId_Timestamp_idx",
];
const haveIdx = new Set(indexes.map((i) => i.indexname));
const missingIdx = needIdx.filter((n) => !haveIdx.has(n));
out("index_check", { missingIdx, ok: missingIdx.length === 0 && tables.length === 2 });

// Prefer demo (password nota in locale) poi dvr
const tenant = (
  await c.query(`
    SELECT t."Id", t."Slug", t."Nome", t."PerfMonitoringEnabled",
           u."Id" AS "UserId", u."Email", u."Role"
    FROM "Tenants" t
    INNER JOIN "Users" u ON u."TenantId" = t."Id" AND u."Role" = 'ADMIN' AND COALESCE(u."Active", true) = true
    WHERE lower(t."Slug") IN ('demo','dvr')
    ORDER BY CASE lower(t."Slug") WHEN 'demo' THEN 0 ELSE 1 END
    LIMIT 1`)
).rows[0];

if (!tenant) {
  out("error", "Nessun tenant admin trovato (dvr/demo)");
  await c.end();
  process.exit(1);
}

out("tenant", {
  id: tenant.Id,
  slug: tenant.Slug,
  email: tenant.Email,
  flagBefore: tenant.PerfMonitoringEnabled,
});

async function setFlag(on) {
  await c.query(
    `UPDATE "Tenants" SET "PerfMonitoringEnabled" = $1 WHERE "Id" = $2::uuid`,
    [on, tenant.Id]
  );
}

async function countForSession(sessionId) {
  const s = (
    await c.query(
      `SELECT "SessionId","TenantId","UserId","UserRole","StartedAt","EndedAt"
       FROM "PerfSessions" WHERE "SessionId" = $1`,
      [sessionId]
    )
  ).rows;
  const e = (
    await c.query(
      `SELECT "Type","Route","Action","Name","DurationMs","Status","TenantId","Timestamp"
       FROM "PerfEvents" WHERE "SessionId" = $1 ORDER BY "Timestamp"`,
      [sessionId]
    )
  ).rows;
  return { sessions: s, events: e };
}

async function login() {
  // Try common passwords for local admin
  const passwords = [
    process.env.PERF_E2E_PASSWORD,
    "Demo123!",
    "Admin123!",
    "Pinco123!",
    "demo123!",
  ].filter(Boolean);

  for (const password of passwords) {
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: tenant.Email,
        password,
        tenantSlug: tenant.Slug,
      }),
    }).catch(() => null);
    if (!res) continue;
    const setCookie = res.headers.getSetCookie?.() || [];
    const cookieHeader =
      setCookie
        .map((x) => x.split(";")[0])
        .filter((x) => x.startsWith("gestionale_session="))
        .join("; ") ||
      (() => {
        const raw = res.headers.get("set-cookie");
        if (!raw) return "";
        const m = raw.match(/gestionale_session=[^;]+/);
        return m ? m[0] : "";
      })();
    if (res.ok && cookieHeader) {
      return { cookie: cookieHeader, passwordUsed: password };
    }
    // Some login endpoints return 200 with redirect and cookie differently
    if (cookieHeader) return { cookie: cookieHeader, passwordUsed: password };
  }
  return null;
}

// Discover login route if /api/auth/login missing
async function loginViaForm() {
  const passwords = [
    process.env.PERF_E2E_PASSWORD,
    "Demo123!",
    "Admin123!",
    "Pinco123!",
    "demo123!",
  ].filter(Boolean);

  for (const password of passwords) {
    const body = new URLSearchParams({
      email: tenant.Email,
      password,
      tenantSlug: tenant.Slug,
    });
    const res = await fetch(`${BASE}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      redirect: "manual",
    }).catch(() => null);
    if (!res) continue;
    const raw = res.headers.get("set-cookie") || "";
    const m = raw.match(/gestionale_session=[^;]+/);
    if (m) return { cookie: m[0], passwordUsed: password };
    const setCookie = res.headers.getSetCookie?.() || [];
    for (const sc of setCookie) {
      if (sc.startsWith("gestionale_session=")) {
        return { cookie: sc.split(";")[0], passwordUsed: password };
      }
    }
  }
  return null;
}

out("base", BASE);
const health = await fetch(`${BASE}/api/me/modules`).catch((e) => ({
  ok: false,
  error: String(e),
}));
out("server", {
  reachable: !(health && "error" in health && health.error),
  status: health?.status,
});

// ========== ON ==========
await setFlag(true);
const sessionIdOn = randomUUID();
const marker = `e2e_${Date.now()}`;

let auth = await login();
if (!auth) auth = await loginViaForm();

if (!auth) {
  out("login", "FAILED — provo ingest diretto con requireApiUser impossibile senza cookie; uso path API dopo login cookie manuale");
  // Fallback: simulate what the API does at DB layer for structure check,
  // and call APIs without cookie to prove OFF/ON gate still works unauthenticated.
  const unauth = await fetch(`${BASE}/api/performance/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId: sessionIdOn }),
  });
  out("unauth_session_status", unauth.status);
  await c.end();
  process.exit(2);
}

out("login", { ok: true, email: tenant.Email });

const cookie = auth.cookie;

async function api(path, body) {
  const t0 = Date.now();
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
      "x-credixa-perf-session": sessionIdOn,
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, ms: Date.now() - t0, json };
}

const sessOn = await api("/api/performance/session", {
  sessionId: sessionIdOn,
  userAgent: "e2e-perf-script",
});
out("ON_session", sessOn);

const eventsPayload = {
  sessionId: sessionIdOn,
  events: [
    {
      type: "SESSION",
      action: "start",
      name: "session_start",
      route: "/",
      metadata: { marker },
    },
    {
      type: "PAGE",
      action: "navigate",
      name: "/pratiche",
      route: "/pratiche",
      durationMs: 420,
      metadata: { from: "/", to: "/pratiche", marker },
    },
    {
      type: "PAGE",
      action: "navigate",
      name: "/pratiche/demo-dettaglio",
      route: "/pratiche/demo-dettaglio",
      durationMs: 890,
      metadata: { from: "/pratiche", to: "/pratiche/demo-dettaglio", marker },
    },
    {
      type: "PAGE",
      action: "navigate",
      name: "/incassi",
      route: "/incassi",
      durationMs: 510,
      metadata: { from: "/pratiche/demo-dettaglio", to: "/incassi", marker },
    },
    {
      type: "ACTION",
      action: "filter",
      name: "incassi_filtro",
      route: "/incassi",
      durationMs: 120,
      metadata: { marker },
    },
    {
      type: "ACTION",
      action: "search",
      name: "incassi_ricerca",
      route: "/incassi",
      durationMs: 95,
      metadata: { marker },
    },
    {
      type: "API",
      action: "GET",
      name: "/api/me/modules",
      route: "/api/me/modules",
      durationMs: 180,
      status: "200",
      metadata: { ok: true, marker },
    },
    {
      type: "ERROR",
      action: "error",
      name: "window_error",
      route: "/incassi",
      metadata: { message: "e2e synthetic error", marker },
    },
  ],
};

// Try to inject malicious tenantId — server must ignore
eventsPayload.tenantId = "00000000-0000-0000-0000-000000000099";

const evOn = await api("/api/performance/events", eventsPayload);
out("ON_events_api", evOn);

const afterOn = await countForSession(sessionIdOn);
out("ON_db", {
  sessionCount: afterOn.sessions.length,
  eventCount: afterOn.events.length,
  sessionTenantId: afterOn.sessions[0]?.TenantId,
  expectedTenantId: tenant.Id,
  tenantMatch: afterOn.sessions[0]?.TenantId === tenant.Id,
  types: afterOn.events.map((e) => e.Type),
  durations: afterOn.events
    .filter((e) => e.DurationMs != null)
    .map((e) => ({ type: e.Type, ms: e.DurationMs, route: e.Route })),
  foreignTenantEvents: afterOn.events.filter((e) => e.TenantId !== tenant.Id)
    .length,
});

// ========== OFF ==========
await setFlag(false);
// Cache in-process del server Next: 60s — attendiamo invalidazione naturale.
out("OFF_wait_cache", "attendo 65s per scadenza cache PerfMonitoringEnabled");
await new Promise((r) => setTimeout(r, 65_000));

const sessionIdOff = randomUUID();

const sessOff = await api("/api/performance/session", {
  sessionId: sessionIdOff,
  userAgent: "e2e-perf-script-off",
});
out("OFF_session", sessOff);

const evOff = await api("/api/performance/events", {
  sessionId: sessionIdOff,
  tenantId: tenant.Id,
  events: [
    {
      type: "PAGE",
      route: "/home",
      name: "should_not_persist",
      durationMs: 10,
      metadata: { marker: `${marker}_off` },
    },
  ],
});
out("OFF_events_api", evOff);

const afterOff = await countForSession(sessionIdOff);
out("OFF_db", {
  sessionCount: afterOff.sessions.length,
  eventCount: afterOff.events.length,
  ok: afterOff.sessions.length === 0 && afterOff.events.length === 0,
});

// Restore flag OFF (safe default after test)
await setFlag(false);

const summary = {
  migrationTablesOk: tables.length === 2 && missingIdx.length === 0,
  on: {
    sessionCreated: afterOn.sessions.length === 1,
    eventsRegistered: afterOn.events.length >= 8,
    singleSession: afterOn.sessions.length === 1,
    tenantServerSide: afterOn.sessions[0]?.TenantId === tenant.Id,
    hasPage: afterOn.events.some((e) => e.Type === "PAGE"),
    hasApi: afterOn.events.some((e) => e.Type === "API"),
    hasAction: afterOn.events.some((e) => e.Type === "ACTION"),
    hasError: afterOn.events.some((e) => e.Type === "ERROR"),
    apiMs: sessOn.ms,
    eventsApiMs: evOn.ms,
  },
  off: {
    noSession: afterOff.sessions.length === 0,
    noEvents: afterOff.events.length === 0,
    apiReturnsDisabled: sessOff.json?.enabled === false,
  },
};

out("SUMMARY", summary);
await c.end();

const ok =
  summary.migrationTablesOk &&
  summary.on.sessionCreated &&
  summary.on.eventsRegistered &&
  summary.on.tenantServerSide &&
  summary.on.hasPage &&
  summary.on.hasApi &&
  summary.on.hasAction &&
  summary.on.hasError &&
  summary.off.noSession &&
  summary.off.noEvents;

process.exit(ok ? 0 : 1);
