import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import os from "node:os";
import path from "node:path";
import { after, before, describe, test } from "node:test";
import { createHmac } from "node:crypto";
import { createApp } from "../src/app.js";
import { DuplicateExternalApplicationError } from "../src/store/applicationStore.js";
import { ApplicationStore } from "../src/store/applicationStore.js";
import { LocalDocumentStorage } from "../src/storage/localDocumentStorage.js";
import type { AuthConfig } from "../src/auth.js";

const TENANT_A = "TENANT-A";
const TENANT_B = "TENANT-B";
const SECRET_A = "secret-a-value";
const SECRET_B = "secret-b-value";
const JOB_ID = "TEST-INDEED-JOB-NAPOLI-CONSULENTE-RC";

describe("Receiver Credixa-facing", () => {
  let tmpRoot = "";
  let server: Server;
  let baseUrl = "";
  let store: ApplicationStore;
  let storage: LocalDocumentStorage;
  const auth: AuthConfig = {
    mode: "api_key",
    secrets: new Map([
      [TENANT_A, SECRET_A],
      [TENANT_B, SECRET_B],
    ]),
  };
  const sourceAuth: AuthConfig = {
    mode: "api_key",
    secrets: new Map([
      [TENANT_A, "source-secret-a"],
      [TENANT_B, "source-secret-b"],
    ]),
  };

  before(async () => {
    tmpRoot = await mkdtemp(path.join(os.tmpdir(), "rcv-"));
    storage = new LocalDocumentStorage(
      path.join(tmpRoot, "storage"),
      "http://127.0.0.1", // rewritten after listen
      "tmp-sign-secret"
    );
    store = new ApplicationStore(storage);
    const app = createApp({
      store,
      storage,
      auth,
      sourceAuth,
      cvOpenTtlSeconds: 120,
    });
    server = createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve());
    });
    const addr = server.address();
    if (!addr || typeof addr === "string") throw new Error("no bind");
    baseUrl = `http://127.0.0.1:${addr.port}`;
    storage.setPublicBaseUrl(baseUrl);
  });

  after(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
    await rm(tmpRoot, { recursive: true, force: true });
  });

  function headers(tenantId: string, secret: string) {
    return {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Credixa-Tenant-Id": tenantId,
      "X-Receiver-Key": secret,
    };
  }

  async function api(
    method: string,
    urlPath: string,
    opts: {
      tenantId: string;
      secret: string;
      body?: unknown;
    }
  ) {
    const res = await fetch(`${baseUrl}${urlPath}`, {
      method,
      headers: headers(opts.tenantId, opts.secret),
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
    const text = await res.text();
    let json: unknown = null;
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        json = text;
      }
    }
    return { status: res.status, json, text };
  }

  test("auth invalida → 401", async () => {
    const res = await api("GET", `/v1/tenants/${TENANT_A}/sync-status`, {
      tenantId: TENANT_A,
      secret: "wrong",
    });
    assert.equal(res.status, 401);
  });

  test("tenant header diverso dal path → 403", async () => {
    const res = await fetch(`${baseUrl}/v1/tenants/${TENANT_A}/sync-status`, {
      headers: {
        "X-Credixa-Tenant-Id": TENANT_B,
        "X-Receiver-Key": SECRET_B,
      },
    });
    assert.equal(res.status, 403);
  });

  test("auth valida + sync-status", async () => {
    const res = await api("GET", `/v1/tenants/${TENANT_A}/sync-status`, {
      tenantId: TENANT_A,
      secret: SECRET_A,
    });
    assert.equal(res.status, 200);
    const body = res.json as {
      ok: boolean;
      lastSyncAt: string | null;
      pendingCount: number;
    };
    assert.equal(body.ok, true);
    assert.equal(body.pendingCount, 0);
    assert.equal(body.lastSyncAt, null);
  });

  test("externalApplicationId univoco per tenant", () => {
    store.seedApplication({
      tenantId: TENANT_A,
      externalApplicationId: "ext-unique-1",
      indeedJobId: JOB_ID,
      firstName: "A",
      lastName: "B",
    });
    assert.throws(
      () =>
        store.seedApplication({
          tenantId: TENANT_A,
          externalApplicationId: "ext-unique-1",
          indeedJobId: JOB_ID,
          firstName: "C",
          lastName: "D",
        }),
      (e: unknown) => e instanceof DuplicateExternalApplicationError
    );
    // stesso external su altro tenant OK
    store.seedApplication({
      tenantId: TENANT_B,
      externalApplicationId: "ext-unique-1",
      indeedJobId: JOB_ID,
      firstName: "E",
      lastName: "F",
    });
  });

  test("GET lista + dettaglio + isolamento tenant", async () => {
    const appA = store.seedApplication({
      tenantId: TENANT_A,
      externalApplicationId: "ext-list-a",
      indeedJobId: JOB_ID,
      firstName: "Anna",
      lastName: "Rossi",
      email: "anna@example.com",
      phone: "+390000",
      coverLetter: "cover-secret",
      source: "creditcore-test",
    });
    const appB = store.seedApplication({
      tenantId: TENANT_B,
      externalApplicationId: "ext-list-b",
      indeedJobId: JOB_ID,
      firstName: "Bruno",
      lastName: "Bianchi",
    });

    const listA = await api(
      "GET",
      `/v1/tenants/${TENANT_A}/applications?indeedJobId=${encodeURIComponent(JOB_ID)}`,
      { tenantId: TENANT_A, secret: SECRET_A }
    );
    assert.equal(listA.status, 200);
    assert.ok(Array.isArray(listA.json));
    const items = listA.json as Array<Record<string, unknown>>;
    assert.ok(items.some((i) => i.receiverCandidateId === appA.receiverCandidateId));
    assert.ok(
      items.every((i) => i.receiverCandidateId !== appB.receiverCandidateId)
    );

    const detailOk = await api(
      "GET",
      `/v1/tenants/${TENANT_A}/applications/${appA.receiverCandidateId}`,
      { tenantId: TENANT_A, secret: SECRET_A }
    );
    assert.equal(detailOk.status, 200);
    const dto = detailOk.json as Record<string, unknown>;
    assert.equal(dto.externalApplicationId, "ext-list-a");
    assert.equal(dto.indeedJobId, JOB_ID);
    assert.equal(dto.firstName, "Anna");
    assert.ok(!JSON.stringify(dto).includes("internalStorageRef"));
    assert.ok(!JSON.stringify(dto).includes("base64"));
    assert.ok(!JSON.stringify(dto).includes("local://"));

    // Tenant A non legge candidatura di B
    const cross = await api(
      "GET",
      `/v1/tenants/${TENANT_A}/applications/${appB.receiverCandidateId}`,
      { tenantId: TENANT_A, secret: SECRET_A }
    );
    assert.equal(cross.status, 404);

    // Auth B ma path A → 403
    const mismatch = await fetch(
      `${baseUrl}/v1/tenants/${TENANT_A}/applications/${appA.receiverCandidateId}`,
      {
        headers: {
          "X-Credixa-Tenant-Id": TENANT_B,
          "X-Receiver-Key": SECRET_B,
        },
      }
    );
    assert.equal(mismatch.status, 403);
  });

  test("cv-open assente → 404; presente → URL temporaneo", async () => {
    const app = store.seedApplication({
      tenantId: TENANT_A,
      externalApplicationId: "ext-cv-1",
      indeedJobId: JOB_ID,
      firstName: "Cv",
      lastName: "Test",
    });

    const missing = await api(
      "POST",
      `/v1/tenants/${TENANT_A}/applications/${app.receiverCandidateId}/cv-open`,
      { tenantId: TENANT_A, secret: SECRET_A, body: {} }
    );
    assert.equal(missing.status, 404);

    const pdf = Buffer.from("%PDF-1.4 test-cv-bytes");
    const doc = await store.attachDocument({
      tenantId: TENANT_A,
      receiverCandidateId: app.receiverCandidateId,
      fileName: "cv.pdf",
      contentType: "application/pdf",
      bytes: pdf,
    });

    const detail = await api(
      "GET",
      `/v1/tenants/${TENANT_A}/applications/${app.receiverCandidateId}`,
      { tenantId: TENANT_A, secret: SECRET_A }
    );
    const d = detail.json as {
      cvRef: string;
      resumeMeta: Record<string, unknown>;
    };
    assert.equal(d.cvRef, `rcv-cv:${doc.documentId}`);
    assert.equal(d.resumeMeta.present, true);
    assert.equal(d.resumeMeta.documentId, doc.documentId);
    assert.ok(!JSON.stringify(d).includes("internalStorageRef"));
    assert.ok(!JSON.stringify(d).includes(pdf.toString("utf8")));

    const opened = await api(
      "POST",
      `/v1/tenants/${TENANT_A}/applications/${app.receiverCandidateId}/cv-open`,
      { tenantId: TENANT_A, secret: SECRET_A, body: {} }
    );
    assert.equal(opened.status, 200);
    const openBody = opened.json as { openUrl: string; expiresAt: string };
    assert.ok(openBody.openUrl.startsWith(baseUrl));
    assert.ok(openBody.expiresAt);

    // openUrl non salvato sull'application
    const again = store.getByCandidateId(TENANT_A, app.receiverCandidateId)!;
    assert.ok(!JSON.stringify(again).includes(openBody.openUrl));

    const fileRes = await fetch(openBody.openUrl);
    assert.equal(fileRes.status, 200);
    const buf = Buffer.from(await fileRes.arrayBuffer());
    assert.deepEqual(buf, pdf);
  });

  test("HMAC auth mode", async () => {
    const hmacAuth: AuthConfig = {
      mode: "hmac",
      secrets: new Map([[TENANT_A, SECRET_A]]),
    };
    const hmacApp = createApp({
      store,
      storage,
      auth: hmacAuth,
      sourceAuth,
      cvOpenTtlSeconds: 60,
    });
    const s = createServer(hmacApp);
    await new Promise<void>((r) => s.listen(0, "127.0.0.1", () => r()));
    const addr = s.address();
    if (!addr || typeof addr === "string") throw new Error("bind");
    const url = `http://127.0.0.1:${addr.port}`;
    const p = `/v1/tenants/${TENANT_A}/sync-status`;
    const ts = String(Math.floor(Date.now() / 1000));
    const body = "";
    const sig = createHmac("sha256", SECRET_A)
      .update(`GET\n${p}\n${ts}\n${body}`)
      .digest("hex");
    const ok = await fetch(`${url}${p}`, {
      headers: {
        "X-Credixa-Tenant-Id": TENANT_A,
        "X-Receiver-Timestamp": ts,
        "X-Receiver-Signature": sig,
      },
    });
    assert.equal(ok.status, 200);
    const bad = await fetch(`${url}${p}`, {
      headers: {
        "X-Credixa-Tenant-Id": TENANT_A,
        "X-Receiver-Timestamp": ts,
        "X-Receiver-Signature": "deadbeef",
      },
    });
    assert.equal(bad.status, 401);
    await new Promise<void>((r, j) => s.close((e) => (e ? j(e) : r())));
  });
});
