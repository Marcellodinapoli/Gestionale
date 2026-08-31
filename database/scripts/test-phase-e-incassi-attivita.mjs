/**
 * Test FASE E — Incassi + Attività via Connettore
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

async function run() {
  console.log("FASE E — test Incassi/Attività");
  assert((await req("GET", "/health")).status === 200, "health");

  const demo = await tenant("demo");
  const demoId = demo.Id;

  const pList = await req("POST", "/api/v1/tenants/demo/pratiche/list", {
    filter: {},
    take: 1,
  });
  assert(pList.status === 200 && pList.json.items?.length > 0, "pratica demo");
  const praticaId = pList.json.items[0].Id ?? pList.json.items[0].id;
  const userId =
    pList.json.items[0].AssegnatarioId ??
    pList.json.items[0].assegnatarioId ??
    demoId;
  assert(userId !== demoId, "pratica con assegnatario per test attivita");

  const iCount = await req("POST", "/api/v1/tenants/demo/incassi/count", {
    filter: { praticaId },
  });
  assert(iCount.status === 200, "incassi count");
  console.log(`✓ incassi count pratica: ${iCount.json.total}`);

  const iAgg = await req("POST", "/api/v1/tenants/demo/incassi/aggregate", {
    filter: { praticaId },
  });
  assert(iAgg.status === 200, "incassi aggregate");
  console.log(`✓ incassi aggregate sum: ${iAgg.json._sum?.importo ?? 0}`);

  const iGroup = await req("POST", "/api/v1/tenants/demo/incassi/group-by-metodo", {
    filter: { tenantId: demoId },
  });
  assert(iGroup.status === 200 && Array.isArray(iGroup.json.items), "group-by-metodo");
  console.log(`✓ incassi group-by-metodo: ${iGroup.json.items.length} metodi`);

  const iList = await req("POST", "/api/v1/tenants/demo/incassi/list", {
    filter: { praticaId },
    take: 5,
    includePratica: true,
  });
  assert(iList.status === 200, "incassi list");
  console.log(`✓ incassi list: ${iList.json.items?.length ?? 0} rows`);

  const aCreate = await req("POST", "/api/v1/tenants/demo/attivita/", {
    praticaId,
    userId,
    tipo: "NOTA",
    nota: `Test FASE E ${Date.now()}`,
  });
  assert(aCreate.status === 201, "attivita create");
  const attivitaId = aCreate.json.item?.Id ?? aCreate.json.item?.id;
  console.log(`✓ attivita create: ${attivitaId}`);

  const aGet = await req("GET", `/api/v1/tenants/demo/attivita/${attivitaId}`);
  assert(aGet.status === 200, "attivita get");
  console.log("✓ attivita get OK");

  const aPatch = await req("PATCH", `/api/v1/tenants/demo/attivita/${attivitaId}`, {
    nota: "Nota aggiornata FASE E",
  });
  assert(aPatch.status === 200, "attivita patch");
  console.log("✓ attivita PATCH OK");

  const aList = await req("POST", "/api/v1/tenants/demo/attivita/list", {
    filter: { praticaId },
    includeUser: true,
    take: 10,
  });
  assert(aList.status === 200 && aList.json.items?.length >= 1, "attivita list");
  console.log(`✓ attivita list: ${aList.json.items.length} rows`);

  const aGroup = await req("POST", "/api/v1/tenants/demo/attivita/group-by-user", {
    filter: { praticaId },
  });
  assert(aGroup.status === 200, "attivita group-by-user");
  console.log(`✓ attivita group-by-user: ${aGroup.json.items?.length ?? 0} users`);

  await req("POST", "/api/v1/tenants/demo/attivita/toggle-fissa", {
    attivitaId,
    praticaId,
    fissata: true,
  });
  console.log("✓ attivita toggle-fissa OK");

  const crossA = await req("GET", `/api/v1/tenants/alfa/attivita/${attivitaId}`);
  assert(crossA.status === 404, "attivita cross-tenant");
  console.log(`✓ attivita isolation alfa: ${crossA.status}`);

  const alfaPratica = await req("POST", "/api/v1/tenants/alfa/pratiche/list", { take: 1 });
  if (alfaPratica.json.items?.[0]) {
    const alfaPraticaId = alfaPratica.json.items[0].Id ?? alfaPratica.json.items[0].id;
    const crossI = await req("POST", "/api/v1/tenants/alfa/incassi/count", {
      filter: { praticaId: alfaPraticaId },
    });
    assert(crossI.status === 200, "alfa incassi count");
    console.log(`✓ incassi alfa count: ${crossI.json.total}`);
  }

  console.log("\nTutti i test FASE E Connettore superati.");
}

run().catch((e) => {
  console.error("FAIL:", e.message);
  process.exit(1);
});
