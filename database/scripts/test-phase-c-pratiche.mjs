/**
 * Test FASE C — dominio Pratiche via Connettore (tenant isolation + CRUD base).
 * Uso: node database/scripts/test-phase-c-pratiche.mjs
 */
const BASE = process.env.CONNECTOR_BASE_URL || "http://localhost:8443";

const TENANTS = [
  { slug: "demo", label: "demo" },
  { slug: "alfa", label: "alfa" },
];

const scopeAdmin = (tenantId) => ({
  tenantId,
  role: "ADMIN",
  userId: "test-admin",
  memberIds: [],
});

async function req(method, path, body) {
  const url = `${BASE}${path}`;
  const res = await fetch(url, {
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

async function resolveTenant(slug) {
  const r = await req("GET", `/api/v1/tenants/${slug}/auth/tenant`);
  const tenant = r.json.tenant;
  assert(r.status === 200 && tenant?.Id, `tenant ${slug}: status ${r.status}`);
  return { id: tenant.Id, slug: tenant.Slug };
}

async function listFirst(tenantSlug, tenantId, filter = {}) {
  const r = await req("POST", `/api/v1/tenants/${tenantSlug}/pratiche/list`, {
    scope: scopeAdmin(tenantId),
    filter,
    page: 1,
    pageSize: 5,
    include: ["debitore", "mandante"],
  });
  assert(r.status === 200, `list ${tenantSlug}: ${r.status} ${JSON.stringify(r.json)}`);
  return r.json;
}

async function run() {
  console.log("FASE C — test Connettore Pratiche");
  console.log("Base URL:", BASE);

  const health = await req("GET", "/health");
  assert(health.status === 200, "health check failed");

  const tenantMeta = {};
  for (const t of TENANTS) {
    tenantMeta[t.slug] = await resolveTenant(t.slug);
    console.log(`✓ tenant ${t.slug} → ${tenantMeta[t.slug].id}`);
  }

  // List + pagination
  for (const t of TENANTS) {
    const tid = tenantMeta[t.slug].id;
    const list = await listFirst(t.slug, tid);
    assert(Array.isArray(list.items), "items array");
    assert(typeof list.total === "number", "total number");
    console.log(`✓ list ${t.slug}: ${list.items.length}/${list.total} (page 1)`);

    const count = await req("POST", `/api/v1/tenants/${t.slug}/pratiche/count`, {
      scope: scopeAdmin(tid),
      filter: { stato: "IN_LAVORAZIONE" },
    });
    assert(count.status === 200, `count ${t.slug}`);
    console.log(`✓ count IN_LAVORAZIONE ${t.slug}: ${count.json.total ?? count.json.count ?? count.json}`);
  }

  // Search
  const demoId = tenantMeta.demo.id;
  const search = await req("POST", `/api/v1/tenants/demo/pratiche/search`, {
    scope: scopeAdmin(demoId),
    filter: { q: "PRC" },
    pageSize: 3,
  });
  assert(search.status === 200, "search demo");
  console.log(`✓ search demo: ${search.json.items?.length ?? 0} hits`);

  // Importo filter SQL-side
  const importoIds = await req("POST", `/api/v1/tenants/demo/pratiche/ids-importo-totale`, {
    tenantId: demoId,
    da: 1000,
    a: 50000,
  });
  assert(importoIds.status === 200, "ids-importo-totale");
  console.log(`✓ ids-importo-totale demo: ${importoIds.json.ids?.length ?? 0} ids`);

  // Detail first pratica demo
  const demoList = await listFirst("demo", demoId);
  assert(demoList.items.length > 0, "demo has pratiche");
  const praticaId = demoList.items[0].id ?? demoList.items[0].Id;

  const detail = await req("GET", `/api/v1/tenants/demo/pratiche/${praticaId}?include=debitore,mandante,rate,incassi`);
  assert(detail.status === 200, `detail demo ${praticaId}`);
  const detailItem = detail.json.item ?? detail.json;
  assert((detailItem.id ?? detailItem.Id) === praticaId, "detail id match");
  console.log(`✓ detail demo: ${praticaId}`);

  // Tenant isolation — demo pratica not visible on alfa
  const cross = await req("GET", `/api/v1/tenants/alfa/pratiche/${praticaId}`);
  assert(cross.status === 404 || cross.status === 403, `cross-tenant must fail, got ${cross.status}`);
  console.log(`✓ tenant isolation: demo pratica blocked on alfa (${cross.status})`);

  const canAccessDemo = await req("POST", `/api/v1/tenants/demo/pratiche/can-access`, {
    scope: scopeAdmin(demoId),
    praticaId,
  });
  assert(canAccessDemo.status === 200 && canAccessDemo.json.ok === true, "can-access demo");

  const canAccessCross = await req("POST", `/api/v1/tenants/alfa/pratiche/can-access`, {
    scope: scopeAdmin(tenantMeta.alfa.id),
    praticaId,
  });
  assert(
    canAccessCross.status === 200 && canAccessCross.json.ok === false,
    "can-access cross tenant"
  );
  console.log("✓ can-access isolation OK");

  // PATCH nota field via update (minimal)
  const patch = await req("PATCH", `/api/v1/tenants/demo/pratiche/${praticaId}`, {
    tenantId: demoId,
    data: { note: `test-fase-c-${Date.now()}` },
  });
  assert(patch.status === 200, `patch ${patch.status}`);
  console.log("✓ PATCH pratica OK");

  // Stato endpoint
  const stato = await req("POST", `/api/v1/tenants/demo/pratiche/${praticaId}/stato`, {
    tenantId: demoId,
    stato: detailItem.stato ?? detailItem.Stato,
  });
  assert(stato.status === 200, `stato ${stato.status}`);
  console.log("✓ POST stato OK");

  // Error handling — invalid tenant
  const badTenant = await req("GET", "/api/v1/tenants/unknown-xyz/pratiche/x");
  assert(badTenant.status >= 400, "unknown tenant error");
  console.log(`✓ error handling unknown tenant: ${badTenant.status}`);

  console.log("\nTutti i test FASE C Connettore superati.");
}

run().catch((e) => {
  console.error("FAIL:", e.message);
  process.exit(1);
});
