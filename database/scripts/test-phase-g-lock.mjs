/**
 * FASE G — test Lock via Connettore (incluso concorrenza)
 */
const BASE = process.env.CONNECTOR_BASE_URL || "http://localhost:8443";

async function req(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : null,
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json, ms: 0 };
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

async function praticaId(slug) {
  const r = await req("POST", `/api/v1/tenants/${slug}/pratiche/list`, { filter: {}, take: 1 });
  assert(r.status === 200 && r.json.items?.[0], "pratica");
  const p = r.json.items[0];
  return String(p.Id ?? p.id);
}

async function acquire(slug, pid, userId) {
  const t0 = performance.now();
  const r = await req("POST", `/api/v1/tenants/${slug}/pratiche/${pid}/lock/acquire`, { userId });
  return { ...r, ms: Math.round(performance.now() - t0) };
}

async function renew(slug, pid, userId) {
  const t0 = performance.now();
  const r = await req("POST", `/api/v1/tenants/${slug}/pratiche/${pid}/lock`, { userId });
  return { ...r, ms: Math.round(performance.now() - t0) };
}

async function release(slug, pid, userId) {
  const t0 = performance.now();
  const r = await req("DELETE", `/api/v1/tenants/${slug}/pratiche/${pid}/lock`, { userId });
  return { ...r, ms: Math.round(performance.now() - t0) };
}

async function status(slug, pid, userId) {
  const t0 = performance.now();
  const r = await req("GET", `/api/v1/tenants/${slug}/pratiche/${pid}/lock?userId=${encodeURIComponent(userId)}`);
  return { ...r, ms: Math.round(performance.now() - t0) };
}

async function run() {
  console.log("FASE G — test Lock");
  assert((await req("GET", "/health")).status === 200, "health");

  const demo = await tenant("demo");
  const alfa = await tenant("alfa");
  const admin = await userByEmail(demo.Id, "admin@gestionale.local");

  const pDemo = await praticaId("demo");
  const pAlfa = await praticaId("alfa");

  const userA = admin.Id;
  const list = await req("POST", `/api/v1/tenants/demo/pratiche/list`, { filter: {}, take: 20 });
  let userB = userA;
  for (const p of list.json.items || []) {
    const uid = p.AssegnatarioId ?? p.assegnatarioId;
    if (uid && String(uid).toLowerCase() !== String(userA).toLowerCase()) {
      userB = String(uid);
      break;
    }
  }
  if (userB === userA) {
    console.log("⚠ userB = userA (solo admin) — test concorrenza limitato");
  }

  await release("demo", pDemo, userA);
  await release("demo", pDemo, userB);

  // 1. A acquire
  const a1 = await acquire("demo", pDemo, userA);
  assert(a1.status === 200 && a1.json.owned === true, "A acquire");
  console.log(`✓ A acquire (${a1.ms}ms)`);

  // 2. B blocked
  const b1 = await acquire("demo", pDemo, userB);
  assert(b1.status === 200 && b1.json.owned === false && b1.json.lockedByName, "B blocked");
  console.log(`✓ B blocked by ${b1.json.lockedByName}`);

  // 3. A renew
  const r1 = await renew("demo", pDemo, userA);
  assert(r1.status === 200 && r1.json.owned === true, "A renew");
  console.log(`✓ A renew (${r1.ms}ms)`);

  // 4. A release
  const rel = await release("demo", pDemo, userA);
  assert(rel.status === 200, "A release");
  console.log(`✓ A release (${rel.ms}ms)`);

  // 5. B acquire after release
  const b2 = await acquire("demo", pDemo, userB);
  assert(b2.status === 200 && b2.json.owned === true, "B acquire after release");
  console.log(`✓ B acquire after release`);

  await release("demo", pDemo, userB);

  // 6. Concurrent acquire — exactly one wins
  await release("demo", pDemo, userA);
  await release("demo", pDemo, userB);
  const [cA, cB] = await Promise.all([
    acquire("demo", pDemo, userA),
    acquire("demo", pDemo, userB),
  ]);
  const winners = [cA, cB].filter((r) => r.json?.owned === true);
  assert(winners.length === 1, `concurrent: expected 1 winner, got ${winners.length}`);
  console.log(`✓ concurrent acquire: 1 winner (${cA.ms}ms / ${cB.ms}ms)`);
  await release("demo", pDemo, userA);
  await release("demo", pDemo, userB);

  // 7. Tenant isolation
  await acquire("demo", pDemo, userA);
  const alfaSt = await status("alfa", pAlfa, userA);
  assert(alfaSt.status === 200, "alfa status");
  console.log(`✓ tenant isolation demo lock ≠ alfa (${alfaSt.json.owned ? "owned" : "free"})`);
  await release("demo", pDemo, userA);

  // 8. getStatus benchmark
  await acquire("demo", pDemo, userA);
  const st = await status("demo", pDemo, userA);
  assert(st.status === 200 && st.json.owned === true, "status owned");
  console.log(`✓ getStatus (${st.ms}ms)`);
  await release("demo", pDemo, userA);

  console.log("\nFASE G connector lock tests OK");
}

run().catch((e) => {
  console.error("FAIL:", e.message);
  process.exit(1);
});
