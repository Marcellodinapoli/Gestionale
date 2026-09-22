import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import os from "node:os";
import path from "node:path";
import { after, before, describe, test } from "node:test";
import { createApp } from "../src/app.js";
import type { AuthConfig } from "../src/auth.js";
import { ApplicationStore } from "../src/store/applicationStore.js";
import { LocalDocumentStorage } from "../src/storage/localDocumentStorage.js";

const TENANT_A = "TENANT-A";
const TENANT_B = "TENANT-B";
const CREDIXA_SECRET_A = "credixa-secret-a";
const SOURCE_SECRET_A = "source-secret-a";
const SOURCE_SECRET_B = "source-secret-b";
const JOB_ID = "TEST-INDEED-JOB-NAPOLI-CONSULENTE-RC";
const MAX_CV = 2048;

describe("Receiver SOURCE endpoints", () => {
  let tmpRoot = "";
  let server: Server;
  let baseUrl = "";
  let store: ApplicationStore;
  let storage: LocalDocumentStorage;

  const auth: AuthConfig = {
    mode: "api_key",
    secrets: new Map([[TENANT_A, CREDIXA_SECRET_A]]),
  };
  const sourceAuth: AuthConfig = {
    mode: "api_key",
    secrets: new Map([
      [TENANT_A, SOURCE_SECRET_A],
      [TENANT_B, SOURCE_SECRET_B],
    ]),
  };

  before(async () => {
    tmpRoot = await mkdtemp(path.join(os.tmpdir(), "rcv-src-"));
    storage = new LocalDocumentStorage(
      path.join(tmpRoot, "storage"),
      "http://127.0.0.1",
      "tmp-sign-secret"
    );
    store = new ApplicationStore(storage);
    const app = createApp({
      store,
      storage,
      auth,
      sourceAuth,
      maxCvSizeBytes: MAX_CV,
      cvOpenTtlSeconds: 120,
    });
    server = createServer(app);
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
    const addr = server.address();
    if (!addr || typeof addr === "string") throw new Error("bind");
    baseUrl = `http://127.0.0.1:${addr.port}`;
    storage.setPublicBaseUrl(baseUrl);
  });

  after(async () => {
    await new Promise<void>((r, j) => server.close((e) => (e ? j(e) : r())));
    await rm(tmpRoot, { recursive: true, force: true });
  });

  function sourceHeaders(tenantId: string, secret: string) {
    return {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Source-Tenant-Id": tenantId,
      "X-Receiver-Source-Key": secret,
    };
  }

  function credixaHeaders(tenantId: string) {
    return {
      Accept: "application/json",
      "X-Credixa-Tenant-Id": tenantId,
      "X-Receiver-Key": CREDIXA_SECRET_A,
    };
  }

  async function ingest(
    externalId: string,
    body: Record<string, unknown>,
    opts?: { tenantId?: string; secret?: string }
  ) {
    const tenantId = opts?.tenantId ?? TENANT_A;
    const secret = opts?.secret ?? SOURCE_SECRET_A;
    const res = await fetch(
      `${baseUrl}/v1/tenants/${tenantId}/applications/by-external/${encodeURIComponent(externalId)}`,
      {
        method: "PUT",
        headers: sourceHeaders(tenantId, secret),
        body: JSON.stringify(body),
      }
    );
    const text = await res.text();
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = text;
    }
    return { status: res.status, json };
  }

  async function uploadCv(opts: {
    receiverCandidateId: string;
    documentId: string;
    bytes: Buffer;
    fileName: string;
    contentType: string;
    tenantId?: string;
    secret?: string;
  }) {
    const tenantId = opts.tenantId ?? TENANT_A;
    const secret = opts.secret ?? SOURCE_SECRET_A;
    const res = await fetch(
      `${baseUrl}/v1/tenants/${tenantId}/applications/${opts.receiverCandidateId}/documents/${opts.documentId}`,
      {
        method: "PUT",
        headers: {
          "X-Source-Tenant-Id": tenantId,
          "X-Receiver-Source-Key": secret,
          "Content-Type": opts.contentType,
          "X-File-Name": opts.fileName,
        },
        body: opts.bytes,
      }
    );
    const text = await res.text();
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = text;
    }
    return { status: res.status, json };
  }

  const validBody = (externalId: string) => ({
    externalApplicationId: externalId,
    indeedJobId: JOB_ID,
    firstName: "Anna",
    lastName: "Rossi",
    email: "anna@example.com",
    emailVerified: true,
    phone: "+39000",
    coverLetter: "Motivazione",
    resumeMeta: {
      present: false,
      fileName: "cv.pdf",
      contentType: "application/pdf",
      sizeBytes: null,
    },
    source: "creditcore-test",
  });

  test("18 secret SOURCE e Credixa distinti", () => {
    assert.notEqual(CREDIXA_SECRET_A, SOURCE_SECRET_A);
    assert.notEqual(
      auth.secrets.get(TENANT_A),
      sourceAuth.secrets.get(TENANT_A)
    );
  });

  test("7 auth source invalida → 401", async () => {
    const res = await ingest("ext-auth-bad", validBody("ext-auth-bad"), {
      secret: "wrong",
    });
    assert.equal(res.status, 401);
  });

  test("7b credixa secret non vale come source → 401", async () => {
    const res = await ingest("ext-auth-cross", validBody("ext-auth-cross"), {
      secret: CREDIXA_SECRET_A,
    });
    assert.equal(res.status, 401);
  });

  test("1 ingest candidatura valida", async () => {
    const res = await ingest("ext-ok-1", validBody("ext-ok-1"));
    assert.ok(res.status === 201 || res.status === 200);
    const dto = res.json as Record<string, unknown>;
    assert.ok(typeof dto.receiverCandidateId === "string");
    assert.equal(dto.externalApplicationId, "ext-ok-1");
    assert.equal(dto.indeedJobId, JOB_ID);
    assert.equal(dto.firstName, "Anna");
    const meta = dto.resumeMeta as Record<string, unknown>;
    assert.equal(meta.present, false);
    assert.ok(typeof meta.documentId === "string");
    assert.ok(!JSON.stringify(dto).includes("internalStorageRef"));
    assert.ok(!JSON.stringify(dto).includes("base64"));
  });

  test("2 ingest senza indeedJobId → 400", async () => {
    const body = validBody("ext-no-job");
    delete (body as { indeedJobId?: string }).indeedJobId;
    const res = await ingest("ext-no-job", body);
    assert.equal(res.status, 400);
  });

  test("3 ingest senza nome → 400", async () => {
    const body = { ...validBody("ext-no-name"), firstName: "  " };
    const res = await ingest("ext-no-name", body);
    assert.equal(res.status, 400);
  });

  test("4 externalApplicationId path/body mismatch → 400", async () => {
    const res = await ingest("ext-path", {
      ...validBody("ext-body-other"),
      externalApplicationId: "ext-body-other",
    });
    assert.equal(res.status, 400);
  });

  test("5 ingest ripetuto → stesso receiverCandidateId", async () => {
    const first = await ingest("ext-idem", validBody("ext-idem"));
    const id1 = (first.json as { receiverCandidateId: string })
      .receiverCandidateId;
    const second = await ingest("ext-idem", {
      ...validBody("ext-idem"),
      firstName: "AnnaMaria",
    });
    assert.equal(second.status, 200);
    const id2 = (second.json as { receiverCandidateId: string })
      .receiverCandidateId;
    assert.equal(id1, id2);
    assert.equal((second.json as { firstName: string }).firstName, "AnnaMaria");
    const doc1 = (
      (first.json as { resumeMeta: { documentId: string } }).resumeMeta
    ).documentId;
    const doc2 = (
      (second.json as { resumeMeta: { documentId: string } }).resumeMeta
    ).documentId;
    assert.equal(doc1, doc2);
  });

  test("6 tenant isolation ingest", async () => {
    const a = await ingest("ext-shared-name", validBody("ext-shared-name"), {
      tenantId: TENANT_A,
      secret: SOURCE_SECRET_A,
    });
    const b = await ingest("ext-shared-name", validBody("ext-shared-name"), {
      tenantId: TENANT_B,
      secret: SOURCE_SECRET_B,
    });
    assert.notEqual(
      (a.json as { receiverCandidateId: string }).receiverCandidateId,
      (b.json as { receiverCandidateId: string }).receiverCandidateId
    );
    const cross = await fetch(
      `${baseUrl}/v1/tenants/${TENANT_A}/applications/${(b.json as { receiverCandidateId: string }).receiverCandidateId}`,
      { headers: credixaHeaders(TENANT_A) }
    );
    assert.equal(cross.status, 404);
  });

  test("13 GET dopo ingest (Credixa)", async () => {
    const created = await ingest("ext-get-after", validBody("ext-get-after"));
    const list = await fetch(
      `${baseUrl}/v1/tenants/${TENANT_A}/applications?indeedJobId=${encodeURIComponent(JOB_ID)}`,
      { headers: credixaHeaders(TENANT_A) }
    );
    assert.equal(list.status, 200);
    const items = (await list.json()) as Array<{ externalApplicationId: string }>;
    assert.ok(items.some((i) => i.externalApplicationId === "ext-get-after"));
    const cid = (created.json as { receiverCandidateId: string })
      .receiverCandidateId;
    const detail = await fetch(
      `${baseUrl}/v1/tenants/${TENANT_A}/applications/${cid}`,
      { headers: credixaHeaders(TENANT_A) }
    );
    assert.equal(detail.status, 200);
  });

  test("8+12+14+15+16+17 CV upload, idempotenza, GET, cv-open", async () => {
    const created = await ingest("ext-cv-flow", validBody("ext-cv-flow"));
    const dto = created.json as {
      receiverCandidateId: string;
      resumeMeta: { documentId: string };
    };
    const pdf = Buffer.from("%PDF-1.4 minimal-cv-content");
    assert.ok(pdf.length < MAX_CV);

    const up1 = await uploadCv({
      receiverCandidateId: dto.receiverCandidateId,
      documentId: dto.resumeMeta.documentId,
      bytes: pdf,
      fileName: "cv.pdf",
      contentType: "application/pdf",
    });
    assert.equal(up1.status, 200);
    const upBody = up1.json as {
      application: {
        cvRef: string;
        resumeMeta: Record<string, unknown>;
      };
    };
    assert.equal(upBody.application.resumeMeta.present, true);
    assert.equal(
      upBody.application.cvRef,
      `rcv-cv:${dto.resumeMeta.documentId}`
    );
    assert.ok(!JSON.stringify(up1.json).includes("internalStorageRef"));
    assert.ok(!JSON.stringify(up1.json).includes("base64"));

    const up2 = await uploadCv({
      receiverCandidateId: dto.receiverCandidateId,
      documentId: dto.resumeMeta.documentId,
      bytes: pdf,
      fileName: "cv.pdf",
      contentType: "application/pdf",
    });
    assert.equal(up2.status, 200);

    const detail = await fetch(
      `${baseUrl}/v1/tenants/${TENANT_A}/applications/${dto.receiverCandidateId}`,
      { headers: credixaHeaders(TENANT_A) }
    );
    assert.equal(detail.status, 200);
    const detailJson = (await detail.json()) as {
      resumeMeta: { present: boolean; documentId: string; sizeBytes: number };
      cvRef: string;
    };
    assert.equal(detailJson.resumeMeta.present, true);
    assert.equal(detailJson.resumeMeta.documentId, dto.resumeMeta.documentId);
    assert.equal(detailJson.cvRef, `rcv-cv:${dto.resumeMeta.documentId}`);
    assert.ok(detailJson.resumeMeta.sizeBytes > 0);

    const opened = await fetch(
      `${baseUrl}/v1/tenants/${TENANT_A}/applications/${dto.receiverCandidateId}/cv-open`,
      {
        method: "POST",
        headers: { ...credixaHeaders(TENANT_A), "Content-Type": "application/json" },
        body: "{}",
      }
    );
    assert.equal(opened.status, 200);
    const openJson = (await opened.json()) as { openUrl: string };
    const fileRes = await fetch(openJson.openUrl);
    assert.equal(fileRes.status, 200);
    assert.deepEqual(Buffer.from(await fileRes.arrayBuffer()), pdf);
  });

  test("9 CV upload senza candidatura → 404", async () => {
    const res = await uploadCv({
      receiverCandidateId: "rcv-cand-missing",
      documentId: "rcv-doc-missing",
      bytes: Buffer.from("%PDF-1.4 x"),
      fileName: "cv.pdf",
      contentType: "application/pdf",
    });
    assert.equal(res.status, 404);
  });

  test("10 MIME non consentito → 400", async () => {
    const created = await ingest("ext-bad-mime", validBody("ext-bad-mime"));
    const dto = created.json as {
      receiverCandidateId: string;
      resumeMeta: { documentId: string };
    };
    const res = await uploadCv({
      receiverCandidateId: dto.receiverCandidateId,
      documentId: dto.resumeMeta.documentId,
      bytes: Buffer.from("not-a-pdf"),
      fileName: "cv.exe",
      contentType: "application/octet-stream",
    });
    assert.equal(res.status, 400);
  });

  test("11 file oltre MAX_CV_SIZE_BYTES → 413", async () => {
    const created = await ingest("ext-too-big", validBody("ext-too-big"));
    const dto = created.json as {
      receiverCandidateId: string;
      resumeMeta: { documentId: string };
    };
    const big = Buffer.concat([
      Buffer.from("%PDF-1.4 "),
      Buffer.alloc(MAX_CV + 100, 0x41),
    ]);
    const res = await uploadCv({
      receiverCandidateId: dto.receiverCandidateId,
      documentId: dto.resumeMeta.documentId,
      bytes: big,
      fileName: "cv.pdf",
      contentType: "application/pdf",
    });
    assert.ok(res.status === 413 || res.status === 400);
  });
});
