/**
 * Test FASE D — Debitori + Mandanti via Connettore
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
  console.log("FASE D — test Debitori/Mandanti");
  assert((await req("GET", "/health")).status === 200, "health");

  const demo = await tenant("demo");
  const alfa = await tenant("alfa");
  const demoId = demo.Id;
  const alfaId = alfa.Id;

  const mList = await req("POST", "/api/v1/tenants/demo/mandanti/list", {
    filter: {},
    includePraticaCount: true,
    take: 5,
  });
  assert(mList.status === 200 && mList.json.items?.length > 0, "mandanti list demo");
  console.log(`✓ mandanti list demo: ${mList.json.items.length}/${mList.json.total}`);

  const mCount = await req("POST", "/api/v1/tenants/demo/mandanti/count", { filter: {} });
  assert(mCount.status === 200, "mandanti count");
  console.log(`✓ mandanti count demo: ${mCount.json.total}`);

  const mandanteId = mList.json.items[0].Id ?? mList.json.items[0].id;
  const mDetail = await req("GET", `/api/v1/tenants/demo/mandanti/${mandanteId}?includeCount=1`);
  assert(mDetail.status === 200, "mandante detail");
  console.log(`✓ mandante detail: ${mandanteId}`);

  const crossM = await req("GET", `/api/v1/tenants/alfa/mandanti/${mandanteId}`);
  assert(crossM.status === 404, "mandante cross-tenant");
  console.log(`✓ mandante isolation alfa: ${crossM.status}`);

  const dList = await req("POST", "/api/v1/tenants/demo/debitori/list", { take: 5 });
  assert(dList.status === 200 && dList.json.items?.length > 0, "debitori list");
  console.log(`✓ debitori list demo: ${dList.json.items.length}/${dList.json.total}`);

  const debitoreId = dList.json.items[0].Id ?? dList.json.items[0].id;
  const dDetail = await req("GET", `/api/v1/tenants/demo/debitori/${debitoreId}`);
  assert(dDetail.status === 200, "debitore detail");
  console.log(`✓ debitore detail: ${debitoreId}`);

  const crossD = await req("GET", `/api/v1/tenants/alfa/debitori/${debitoreId}`);
  assert(crossD.status === 404, "debitore cross-tenant");
  console.log(`✓ debitore isolation alfa: ${crossD.status}`);

  const cf = dList.json.items[0].CodiceFiscale ?? dList.json.items[0].codiceFiscale;
  if (cf) {
    const byCf = await req("POST", "/api/v1/tenants/demo/debitori/ids-by-cf", {
      variants: [cf],
    });
    assert(byCf.status === 200 && byCf.json.items?.length >= 1, "ids-by-cf");
    console.log(`✓ ids-by-cf: ${byCf.json.items.length} hit(s)`);
  }

  const patchD = await req("PATCH", `/api/v1/tenants/demo/debitori/${debitoreId}`, {
    telefono: "+3900000000",
  });
  assert(patchD.status === 200, "debitore patch");
  console.log("✓ PATCH debitore OK");

  const recapito = await req("POST", `/api/v1/tenants/demo/debitori/${debitoreId}/recapiti`, {
    tipo: "EMAIL",
    valore: `test-fase-d-${Date.now()}@example.com`,
  });
  assert(recapito.status === 201, "recapito create");
  const recapitoId = recapito.json.item?.Id ?? recapito.json.item?.id;
  console.log(`✓ POST recapito: ${recapitoId}`);

  const alfaList = await req("POST", "/api/v1/tenants/alfa/mandanti/list", { take: 3 });
  assert(alfaList.status === 200, "alfa mandanti");
  console.log(`✓ mandanti alfa: ${alfaList.json.total} total`);

  console.log("\nTutti i test FASE D Connettore superati.");
}

run().catch((e) => {
  console.error("FAIL:", e.message);
  process.exit(1);
});
