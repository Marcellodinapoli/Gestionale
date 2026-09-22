/**
 * Smoke E2E: logica Cloud Function bridge → Receiver locale.
 * Non coinvolge Flutter UI né Credixa.
 *
 * Uso:
 *   cd receiver
 *   npx tsx scripts/e2e_cf_bridge_smoke.ts
 */
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { createApp } from "../src/app.ts";
import { ApplicationStore } from "../src/store/applicationStore.ts";
import { LocalDocumentStorage } from "../src/storage/localDocumentStorage.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const bridgePath = path.resolve(
  __dirname,
  "../../../Creditplanet/functions/receiver_bridge.js"
);
const { createSubmitIndeedReceiverApplication } = require(bridgePath);

const TENANT = "TENANT-E2E";
const SOURCE = "source-e2e-secret";
const CREDIXA = "credixa-e2e-secret";
const JOB = "TEST-INDEED-JOB-NAPOLI-CONSULENTE-RC";

async function main() {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "e2e-rcv-"));
  const storage = new LocalDocumentStorage(
    path.join(tmp, "s"),
    "http://127.0.0.1",
    "tmp"
  );
  const store = new ApplicationStore(storage);
  const app = createApp({
    store,
    storage,
    auth: { mode: "api_key", secrets: new Map([[TENANT, CREDIXA]]) },
    sourceAuth: { mode: "api_key", secrets: new Map([[TENANT, SOURCE]]) },
    maxCvSizeBytes: 1024 * 1024,
  });
  const server = createServer(app);
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  const port = (server.address() as { port: number }).port;
  storage.setPublicBaseUrl(`http://127.0.0.1:${port}`);

  const handler = createSubmitIndeedReceiverApplication({
    admin: {
      firestore: () => ({
        collection: () => ({
          doc: () => ({
            get: async () => ({ exists: true, data: () => ({}) }),
          }),
        }),
      }),
    },
    getConfig: () => ({
      baseUrl: `http://127.0.0.1:${port}`,
      sourceKey: SOURCE,
      sourceTenantId: TENANT,
      tenantMap: {},
    }),
    httpPut: async (url: string, body: unknown, opts: { headers: Record<string, string> }) => {
      const res = await fetch(url, {
        method: "PUT",
        headers: opts.headers,
        body: JSON.stringify(body),
      });
      let data: unknown = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }
      return { status: res.status, data };
    },
    httpPutBinary: async (
      url: string,
      bytes: Buffer,
      opts: { headers: Record<string, string> }
    ) => {
      const res = await fetch(url, {
        method: "PUT",
        headers: opts.headers,
        body: bytes,
      });
      let data: unknown = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }
      return { status: res.status, data };
    },
  });

  const pdf = Buffer.from("%PDF-1.4 e2e-test-cv");
  const result = await handler(
    {
      application: {
        applicationId: `indeed-app-e2e-${Date.now()}`,
        jobId: JOB,
        firstName: "Anna",
        lastName: "Rossi",
        email: "anna.e2e@example.com",
        phoneNumber: "+39333",
        coverletter: "Cover e2e",
        resumeMeta: { fileName: "cv.pdf", contentType: "application/pdf" },
        source: "creditcore-test",
      },
      cvBase64: pdf.toString("base64"),
      cvFileName: "cv.pdf",
      cvContentType: "application/pdf",
    },
    { auth: { uid: "e2e-user" } }
  );

  if (!result.cvPresent) throw new Error("cvPresent false");

  const listRes = await fetch(
    `http://127.0.0.1:${port}/v1/tenants/${TENANT}/applications?indeedJobId=${encodeURIComponent(JOB)}`,
    {
      headers: {
        "X-Credixa-Tenant-Id": TENANT,
        "X-Receiver-Key": CREDIXA,
      },
    }
  );
  const items = (await listRes.json()) as Array<Record<string, unknown>>;
  const found = items.find(
    (i) => i.receiverCandidateId === result.receiverCandidateId
  );
  if (!found) throw new Error("candidatura non in lista Receiver");
  const meta = found.resumeMeta as Record<string, unknown>;
  if (!meta?.present || !found.cvRef) throw new Error("CV meta mancante");

  const openRes = await fetch(
    `http://127.0.0.1:${port}/v1/tenants/${TENANT}/applications/${result.receiverCandidateId}/cv-open`,
    {
      method: "POST",
      headers: {
        "X-Credixa-Tenant-Id": TENANT,
        "X-Receiver-Key": CREDIXA,
        "Content-Type": "application/json",
      },
      body: "{}",
    }
  );
  const openJson = (await openRes.json()) as { openUrl: string };
  const fileRes = await fetch(openJson.openUrl);
  const buf = Buffer.from(await fileRes.arrayBuffer());
  if (!buf.equals(pdf)) throw new Error("byte CV mismatch");

  console.log(
    JSON.stringify({
      ok: true,
      phase: "A_Receiver",
      ...result,
      documentId: meta.documentId,
      cvRef: found.cvRef,
      note: "Credixa sync + Visualizza CV: eseguire manualmente in UI Credixa",
    })
  );

  server.close();
  await rm(tmp, { recursive: true, force: true });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
