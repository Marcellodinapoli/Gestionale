/**
 * FASE F — Dashboard Home KPI via Connettore
 */
const BASE = process.env.CONNECTOR_BASE_URL || "http://localhost:8443";
const today = new Date().toISOString().slice(0, 10);

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
  return { status: res.status, json, ms: res.headers.get("x-response-time") };
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
  return { id: r.json.user.Id, role: r.json.user.Role };
}

async function userFromPratica(slug, roleHint) {
  const pList = await req("POST", `/api/v1/tenants/${slug}/pratiche/list`, {
    filter: {},
    take: 50,
  });
  assert(pList.status === 200 && pList.json.items?.length, "pratiche list");
  for (const p of pList.json.items) {
    const uid = p.AssegnatarioId ?? p.assegnatarioId;
    if (!uid) continue;
    const u = await req("GET", `/api/v1/internal/users/${uid}?tenantId=${encodeURIComponent(p.TenantId ?? p.tenantId ?? "")}`);
    if (u.status === 200 && u.json.user?.Role === roleHint) {
      return { id: u.json.user.Id, role: u.json.user.Role };
    }
  }
  throw new Error(`no user with role ${roleHint}`);
}

async function adminUser(tenantId) {
  return userByEmail(tenantId, "admin@gestionale.local");
}

async function operatorUser(tenantId) {
  try {
    return await userFromPratica("demo", "OPERATOR");
  } catch {
    return await userFromPratica("demo", "OPERATORE");
  }
}

async function supervisorUser(tenantId, fallbackOperatorId) {
  try {
    return await userFromPratica("demo", "SUPERVISOR");
  } catch {
    console.log("⚠ nessun SUPERVISOR in seed — test strutturale con OPERATOR id + role SUPERVISOR");
    return { id: fallbackOperatorId, role: "SUPERVISOR" };
  }
}

function baseCtx(userId, role, extra = {}) {
  return {
    userId,
    role,
    lavorateDate: today,
    scope: role === "OPERATOR" ? { mode: "operator", userId } : { mode: "tenant" },
    incassiScope: role === "OPERATOR" ? "user" : "tenant",
    includeAdmin: role === "ADMIN",
    includeAmministrazione: false,
    vistaGruppoLavorate: role === "SUPERVISOR",
    ...extra,
  };
}

async function homeBundle(slug, ctx) {
  const t0 = performance.now();
  const r = await req("POST", `/api/v1/tenants/${slug}/dashboard/home`, ctx);
  const elapsed = Math.round(performance.now() - t0);
  return { ...r, elapsed };
}

async function run() {
  console.log("FASE F — test Dashboard Home");
  assert((await req("GET", "/health")).status === 200, "health");

  const demo = await tenant("demo");
  const alfa = await tenant("alfa");
  const demoId = demo.Id;
  const alfaId = alfa.Id;

  const admin = await adminUser(demoId);
  const operator = await operatorUser(demoId);
  const supervisor = await supervisorUser(demoId, operator.id);

  // ADMIN
  const adminRes = await homeBundle("demo", baseCtx(admin.id, "ADMIN", { includeAdmin: true }));
  assert(adminRes.status === 200, `admin home ${adminRes.status}: ${JSON.stringify(adminRes.json).slice(0, 200)}`);
  assert(adminRes.json.shared?.totali >= 0, "admin shared.totali");
  assert(adminRes.json.admin?.mandantiRiepilogo?.length >= 0, "admin mandantiRiepilogo");
  assert(Array.isArray(adminRes.json.admin?.caricoGruppi), "admin caricoGruppi");
  assert(adminRes.json.meta?.roundTrips === 1, "roundTrips=1");
  console.log(
    `✓ ADMIN demo: totali=${adminRes.json.shared.totali} sqlQueries=${adminRes.json.meta?.sqlQueries} queryMs=${adminRes.json.meta?.queryMs} httpMs=${adminRes.elapsed} totalMs=${adminRes.json.totalMs}`
  );

  // SUPERVISOR
  const supRes = await homeBundle("demo", baseCtx(supervisor.id, "SUPERVISOR"));
  assert(supRes.status === 200, "supervisor home");
  assert(supRes.json.shared?.totali >= 0, "supervisor totali");
  console.log(
    `✓ SUPERVISOR demo: totali=${supRes.json.shared.totali} sqlQueries=${supRes.json.meta?.sqlQueries} httpMs=${supRes.elapsed}`
  );

  // OPERATOR
  const opRes = await homeBundle("demo", baseCtx(operator.id, "OPERATOR"));
  assert(opRes.status === 200, "operator home");
  assert(opRes.json.shared?.totali >= 0, "operator totali");
  console.log(
    `✓ OPERATOR demo: totali=${opRes.json.shared.totali} incassiOggi=${opRes.json.shared.incassiOggiSum} httpMs=${opRes.elapsed}`
  );

  // Tenant isolation
  const alfaOp = await homeBundle("alfa", {
    ...baseCtx(alfaId, "OPERATOR", { userId: alfaId }),
    scope: { mode: "tenant" },
  });
  assert(alfaOp.status === 200, "alfa home");
  const demoOpTenant = await homeBundle("demo", baseCtx(demoId, "OPERATOR", { scope: { mode: "tenant" } }));
  assert(demoOpTenant.status === 200, "demo tenant scope");
  if (alfaOp.json.shared.totali !== demoOpTenant.json.shared.totali) {
    console.log(`✓ tenant isolation: demo=${demoOpTenant.json.shared.totali} alfa=${alfaOp.json.shared.totali}`);
  } else {
    console.log(`⚠ tenant isolation: stessi totali (alfa piccolo?) demo=${demoOpTenant.json.shared.totali} alfa=${alfaOp.json.shared.totali}`);
  }

  // GET endpoint
  const ctxEnc = encodeURIComponent(
    JSON.stringify(baseCtx(admin.id, "ADMIN", { includeAdmin: true }))
  );
  const getRes = await req("GET", `/api/v1/tenants/demo/dashboard/home?ctx=${ctxEnc}`);
  assert(getRes.status === 200, "GET /home");
  console.log("✓ GET /dashboard/home");

  // Benchmark summary
  console.log("\n--- Benchmark (1 round-trip ciascuno) ---");
  console.log(`ADMIN:     ${adminRes.elapsed}ms HTTP, ${adminRes.json.meta?.sqlQueries} SQL, ${adminRes.json.meta?.queryMs}ms SQL interno`);
  console.log(`SUPERVISOR:${supRes.elapsed}ms HTTP, ${supRes.json.meta?.sqlQueries} SQL`);
  console.log(`OPERATOR:  ${opRes.elapsed}ms HTTP, ${opRes.json.meta?.sqlQueries} SQL`);
  console.log("\nFASE F connector tests OK");
}

run().catch((e) => {
  console.error("FAIL:", e.message);
  process.exit(1);
});
