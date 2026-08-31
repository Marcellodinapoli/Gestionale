/**
 * FASE H — Agenda / Memo via Connettore
 */
const BASE = process.env.CONNECTOR_BASE_URL || "http://localhost:8443";

async function req(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json };
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function tenant(slug) {
  const r = await req("GET", `/api/v1/tenants/${slug}/auth/tenant`);
  assert(r.status === 200 && r.json.tenant?.Id, `tenant ${slug}`);
  return r.json.tenant;
}

async function userByEmail(tenantId, email) {
  const r = await req("POST", `/api/v1/internal/users/by-email`, { tenantId, email });
  assert(r.status === 200 && r.json.user?.Id, `user ${email}`);
  return r.json.user;
}

function scopeCtx(userId, role = "ADMIN") {
  return {
    role,
    userId,
    scope: role === "OPERATOR" ? { mode: "operator", userId } : { mode: "tenant" },
    impegniUserId: userId,
    canAgenda: true,
    memoAtGte: new Date(Date.now() - 60 * 60_000).toISOString(),
    memoAtLte: new Date(Date.now() + 60 * 60_000).toISOString(),
  };
}

async function run() {
  console.log("FASE H — test Agenda / Memo");
  assert((await req("GET", "/health")).status === 200, "health");

  const demo = await tenant("demo");
  const alfa = await tenant("alfa");
  const admin = await userByEmail(demo.Id, "admin@gestionale.local");
  const ctx = scopeCtx(admin.Id);

  const cal = await req("POST", `/api/v1/tenants/demo/agenda/calendario`, ctx);
  assert(cal.status === 200 && Array.isArray(cal.json.pratiche), "calendario demo");
  console.log(`✓ calendario demo: ${cal.json.pratiche.length} pratiche, ${cal.json.impegni?.length ?? 0} impegni`);

  const giorno = await req("POST", `/api/v1/tenants/demo/agenda/giorno`, {
    ...ctx,
    dayStart: new Date().toISOString().slice(0, 10) + "T00:00:00.000Z",
    dayEnd: new Date().toISOString().slice(0, 10) + "T23:59:59.999Z",
  });
  assert(giorno.status === 200, "agenda giorno");

  const alerts = await req("POST", `/api/v1/tenants/demo/agenda/memo-alerts`, ctx);
  assert(alerts.status === 200 && Array.isArray(alerts.json.intern), "memo-alerts bundle");

  const impegno = await req("POST", `/api/v1/tenants/demo/impegni-agenda/`, {
    userId: admin.Id,
    titolo: "Test FASE H",
    nota: "automated",
    memoAt: new Date(Date.now() + 3600_000).toISOString(),
  });
  assert(impegno.status === 201 && impegno.json.item?.id, "create impegno");
  const impegnoId = impegno.json.item.id;
  console.log(`✓ impegno creato ${impegnoId}`);

  const complete = await req("POST", `/api/v1/tenants/demo/impegni-agenda/${impegnoId}/complete`, {
    userId: admin.Id,
  });
  assert(complete.status === 200, "complete impegno");

  const alfaCal = await req("POST", `/api/v1/tenants/alfa/agenda/calendario`, scopeCtx(admin.Id));
  assert(alfaCal.status === 200, "calendario alfa tenant isolation");

  const demoAgain = await req("POST", `/api/v1/tenants/demo/agenda/calendario`, ctx);
  const alfaIds = new Set((alfaCal.json.pratiche ?? []).map((p) => p.id));
  const overlap = (demoAgain.json.pratiche ?? []).some((p) => alfaIds.has(p.id));
  assert(!overlap || alfaIds.size === 0, "tenant isolation demo ↔ alfa");

  console.log("✅ FASE H connector tests OK");
}

run().catch((e) => {
  console.error("❌", e.message);
  process.exit(1);
});
