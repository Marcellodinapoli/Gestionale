/**
 * FASE J — CRUD + tenant isolation (connector)
 * Uso: node database/scripts/test-phase-j-crud.mjs
 */
const base = process.env.CONNECTOR_BASE_URL || "http://localhost:8443";
const headers = { "Content-Type": "application/json" };

async function fetchJson(url, opts = {}) {
  const res = await fetch(url, { ...opts, headers: { ...headers, ...opts.headers } });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${opts.method || "GET"} ${url} → ${res.status}: ${JSON.stringify(json)}`);
  return json;
}

async function tenantId(slug) {
  const j = await fetchJson(`${base}/api/v1/tenants/${slug}/auth/tenant`);
  return j.tenant?.Id;
}

async function testSedi(slug, tid) {
  const nome = `J-Test-${Date.now()}`;
  const created = await fetchJson(`${base}/api/v1/tenants/${slug}/sedi/`, {
    method: "POST",
    body: JSON.stringify({ nome, active: true }),
  });
  const id = created.item?.id ?? created.item?.Id;
  if (!id) throw new Error("sede create failed");
  await fetchJson(`${base}/api/v1/tenants/${slug}/sedi/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ note: "phase-j" }),
  });
  const list = await fetchJson(`${base}/api/v1/tenants/${slug}/sedi/list`, {
    method: "POST",
    body: JSON.stringify({ filter: { id }, includeCounts: true }),
  });
  const found = list.items?.find((s) => (s.id ?? s.Id) === id);
  if (!found) throw new Error("sede list isolation failed");
  console.log(`  sedi OK (${slug}) id=${id}`);
  return id;
}

async function testPostazioni(slug, sedeId) {
  const nome = `Post-J-${Date.now()}`;
  const created = await fetchJson(`${base}/api/v1/tenants/${slug}/postazioni/`, {
    method: "POST",
    body: JSON.stringify({ nome, sedeId, active: true }),
  });
  const id = created.item?.id ?? created.item?.Id;
  if (!id) throw new Error("postazione create failed");
  console.log(`  postazioni OK (${slug}) id=${id}`);
}

async function testConfig(slug) {
  const chiave = `phase.j.${Date.now()}`;
  await fetchJson(`${base}/api/v1/tenants/${slug}/configurazione/upsert`, {
    method: "POST",
    body: JSON.stringify({ chiave, valore: "1" }),
  });
  const got = await fetchJson(`${base}/api/v1/tenants/${slug}/configurazione/${encodeURIComponent(chiave)}`);
  if (!got.item) throw new Error("config get failed");
  console.log(`  configurazione OK (${slug})`);
}

async function testTenantIsolation(demoSedeId, alfaTid) {
  const list = await fetchJson(`${base}/api/v1/tenants/alfa/sedi/list`, {
    method: "POST",
    body: JSON.stringify({ filter: { id: demoSedeId } }),
  });
  const leak = list.items?.find((s) => (s.id ?? s.Id) === demoSedeId);
  if (leak) throw new Error("tenant isolation FAILED: demo sede visible in alfa");
  console.log("  tenant isolation demo↔alfa OK");
}

async function main() {
  console.log("FASE J CRUD test — connector @", base);
  const demoTid = await tenantId("demo");
  const alfaTid = await tenantId("alfa");
  if (!demoTid || !alfaTid) throw new Error("tenant demo/alfa non trovati");

  const sedeId = await testSedi("demo", demoTid);
  await testPostazioni("demo", sedeId);
  await testConfig("demo");
  await testTenantIsolation(sedeId, alfaTid);
  console.log("FASE J CRUD — PASS");
}

main().catch((e) => {
  console.error("FASE J CRUD — FAIL", e.message);
  process.exit(1);
});
