/**
 * FASE I — ImportBatch + Audit via Connettore
 * Uso: node database/scripts/test-phase-i-import-audit.mjs
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

function synthCreate(mandanteId, batchId, lotto, i) {
  const cf = `TST${String(Date.now()).slice(-6)}${String(i).padStart(4, "0")}X`;
  return {
    debitore: {
      nome: "Test",
      cognome: `Import${i}`,
      codiceFiscale: cf,
      telefono: null,
      citta: "Milano",
      indirizzo: null,
      cap: null,
      provincia: "MI",
    },
    pratica: {
      mandanteId,
      numeroMandante: lotto,
      contratto: `C-${i}`,
      commessa: null,
      dataAffido: new Date().toISOString(),
      scadenza: null,
      capitale: 100,
      interessi: 0,
      spese: 0,
      speseRecupero: 0,
      residuo: 100,
      importoRata: null,
      rateArretrate: null,
      nettoDaPagare: 100,
      stato: "AFFIDATA",
      importBatchId: batchId,
    },
  };
}

async function benchmarkChunk(slug, tenantId, mandanteId, batchId, lotto, n, batchSize) {
  const t0 = performance.now();
  let done = 0;
  for (let off = 0; off < n; off += batchSize) {
    const chunk = [];
    for (let i = off; i < Math.min(off + batchSize, n); i++) {
      chunk.push(synthCreate(mandanteId, batchId, lotto, i));
    }
    const r = await req("POST", `/api/v1/tenants/${slug}/import-batch/process-chunk`, {
      creates: chunk,
      updates: [],
    });
    assert(r.status === 200, `benchmark chunk @${off}: ${JSON.stringify(r.json)}`);
    done += chunk.length;
  }
  const ms = performance.now() - t0;
  const rps = Math.round((done / ms) * 1000);
  return { n: done, ms: Math.round(ms), rps };
}

async function run() {
  console.log("FASE I — test Import / Audit");
  assert((await req("GET", "/health")).status === 200, "health");

  const demo = await tenant("demo");
  const alfa = await tenant("alfa");
  const admin = await userByEmail(demo.Id, "admin@gestionale.local");

  const mandList = await req("POST", `/api/v1/tenants/demo/mandanti/list`, { take: 1 });
  assert(mandList.status === 200 && mandList.json.items?.length, "mandante demo");
  const mandante = mandList.json.items[0];
  const mandanteId = mandante.id ?? mandante.Id;
  const mandanteCodice = mandante.codice ?? mandante.Codice ?? "TST";

  const lotto = `PHASE-I-${Date.now()}`;
  const perimetro = "TEST";

  const created = await req("POST", `/api/v1/tenants/demo/import-batch/`, {
    tenantId: demo.Id,
    tipo: "PRATICHE",
    mandanteId: mandanteId,
    mandanteCodice: mandanteCodice,
    perimetro,
    lotto,
    affidoIl: new Date().toISOString(),
    scadenzaMandato: null,
    fileName: "phase-i-test.csv",
    nPratiche: 0,
    createdById: admin.Id,
    createdByName: admin.Name ?? "Admin",
  });
  assert(created.status === 201 && created.json.item?.id, "create ImportBatch");
  const batchId = created.json.item.id;
  console.log(`✓ ImportBatch ${batchId} lotto ${lotto}`);

  const chunk = await req("POST", `/api/v1/tenants/demo/import-batch/process-chunk`, {
    creates: [synthCreate(mandanteId, batchId, lotto, 1), synthCreate(mandanteId, batchId, lotto, 2)],
    updates: [],
  });
  assert(chunk.status === 200 && chunk.json.created === 2, "process-chunk 2 pratiche");
  console.log("✓ process-chunk transazionale (2 create)");

  const linked = await req("POST", `/api/v1/tenants/demo/import-batch/${batchId}/link-pratiche`, {
    batchId,
    mandanteId: mandanteId,
    lotto,
    affidoIl: created.json.item.affidoIl,
  });
  assert(linked.status === 200 && linked.json.totale >= 2, "link-pratiche");

  const listed = await req("POST", `/api/v1/tenants/demo/import-batch/list`, { take: 20 });
  assert(
    listed.json.items.some((b) => b.id === batchId),
    "list ImportBatch demo"
  );

  const alfaList = await req("POST", `/api/v1/tenants/alfa/import-batch/list`, { take: 50 });
  assert(
    !alfaList.json.items.some((b) => b.id === batchId),
    "tenant isolation demo ↔ alfa (ImportBatch)"
  );
  console.log("✓ tenant isolation ImportBatch");

  await req("POST", `/api/v1/tenants/demo/audit/`, {
    userId: admin.Id,
    action: "test_phase_i",
    entity: "importBatch",
    entityId: batchId,
    dettaglio: "automated test — no PII",
  });
  const auditDemo = await req("POST", `/api/v1/tenants/demo/audit/list`, {
    filter: { entity: "importBatch", entityId: batchId, take: 5 },
  });
  assert(
    auditDemo.status === 200 && auditDemo.json.items.some((a) => a.action === "test_phase_i"),
    "audit append + list"
  );

  const auditAlfa = await req("POST", `/api/v1/tenants/alfa/audit/list`, {
    filter: { entityId: batchId, take: 5 },
  });
  assert(
    !auditAlfa.json.items.some((a) => a.entityId === batchId),
    "tenant isolation audit"
  );
  console.log("✓ AuditLog append-only + tenant isolation");

  const badBatch = await req("POST", `/api/v1/tenants/demo/import-batch/`, {
    tenantId: demo.Id,
    tipo: "PRATICHE",
    mandanteId: mandanteId,
    mandanteCodice: mandanteCodice,
    perimetro,
    lotto: `${lotto}-RB`,
    affidoIl: new Date().toISOString(),
    nPratiche: 0,
    createdById: admin.Id,
    createdByName: "Admin",
  });
  const rbBatchId = badBatch.json.item.id;

  const beforeCnt = await req("POST", `/api/v1/tenants/demo/import-batch/count-pratiche`, {
    mandanteId: mandanteId,
    lotto: `${lotto}-RB`,
    affidoIl: badBatch.json.item.affidoIl,
  });

  const badChunk = await req("POST", `/api/v1/tenants/demo/import-batch/process-chunk`, {
    creates: [
      synthCreate(mandanteId, rbBatchId, `${lotto}-RB`, 9001),
      {
        ...synthCreate("00000000-0000-0000-0000-000000000099", rbBatchId, `${lotto}-RB`, 9002),
      },
    ],
    updates: [],
  });
  assert(badChunk.status >= 400, "rollback: chunk invalido deve fallire");

  const afterCnt = await req("POST", `/api/v1/tenants/demo/import-batch/count-pratiche`, {
    mandanteId: mandanteId,
    lotto: `${lotto}-RB`,
    affidoIl: badBatch.json.item.affidoIl,
  });
  assert(
    (afterCnt.json.total ?? 0) === (beforeCnt.json.total ?? 0),
    "rollback: nessuna pratica parziale persistita"
  );
  console.log("✓ rollback transazione SQL su errore chunk");

  const benchBatch = await req("POST", `/api/v1/tenants/demo/import-batch/`, {
    tenantId: demo.Id,
    tipo: "PRATICHE",
    mandanteId: mandanteId,
    mandanteCodice: mandanteCodice,
    perimetro,
    lotto: `${lotto}-BENCH`,
    affidoIl: new Date().toISOString(),
    nPratiche: 0,
    createdById: admin.Id,
    createdByName: "Admin",
  });
  const benchId = benchBatch.json.item.id;

  for (const n of [1000]) {
    const b = await benchmarkChunk("demo", demo.Id, mandanteId, benchId, `${lotto}-BENCH`, n, 500);
    console.log(`✓ benchmark ${n} pratiche: ${b.ms}ms (${b.rps} rec/s, chunk 500)`);
  }

  const bench10k = await req("POST", `/api/v1/tenants/demo/import-batch/`, {
    tenantId: demo.Id,
    tipo: "PRATICHE",
    mandanteId: mandanteId,
    mandanteCodice: mandanteCodice,
    perimetro,
    lotto: `${lotto}-BENCH10K`,
    affidoIl: new Date().toISOString(),
    nPratiche: 0,
    createdById: admin.Id,
    createdByName: "Admin",
  });
  const bench10kId = bench10k.json.item.id;
  const b10k = await benchmarkChunk(
    "demo",
    demo.Id,
    mandanteId,
    bench10kId,
    `${lotto}-BENCH10K`,
    10000,
    500
  );
  console.log(`✓ benchmark 10000 pratiche: ${b10k.ms}ms (${b10k.rps} rec/s, chunk 500)`);

  const bench50k = await req("POST", `/api/v1/tenants/demo/import-batch/`, {
    tenantId: demo.Id,
    tipo: "PRATICHE",
    mandanteId: mandanteId,
    mandanteCodice: mandanteCodice,
    perimetro,
    lotto: `${lotto}-BENCH50K`,
    affidoIl: new Date().toISOString(),
    nPratiche: 0,
    createdById: admin.Id,
    createdByName: "Admin",
  });
  const bench50kId = bench50k.json.item.id;
  const b50k = await benchmarkChunk(
    "demo",
    demo.Id,
    mandanteId,
    bench50kId,
    `${lotto}-BENCH50K`,
    50000,
    500
  );
  console.log(`✓ benchmark 50000 pratiche: ${b50k.ms}ms (${b50k.rps} rec/s, chunk 500)`);

  console.log("✅ FASE I connector tests OK");
}

run().catch((e) => {
  console.error("❌", e.message);
  process.exit(1);
});
