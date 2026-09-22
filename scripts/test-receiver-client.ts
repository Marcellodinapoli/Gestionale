/**
 * Test Credixa → Receiver client (FASE 3).
 * Esegui: npx tsx --import ./scripts/test-hooks/register.mjs scripts/test-receiver-client.ts
 */
import "./test-hooks/register.mjs";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

type TestResult = { name: string; pass: boolean; detail?: string };
const results: TestResult[] = [];

function record(name: string, pass: boolean, detail?: string) {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} — ${name}${detail ? ` (${detail})` : ""}`);
}

async function main() {
  const { ReceiverClientError, assertReceiverRequestBaseUrl } = await import(
    "../src/lib/recruiting/receiver"
  );
  const { buildReceiverAuthHeaders } = await import(
    "../src/lib/recruiting/receiverAuth"
  );
  const {
    listApplications,
    getApplication,
    getCvOpenUrl,
    getSyncStatus,
  } = await import("../src/lib/recruiting/receiverClient");

  const prevSecrets = process.env.RECEIVER_SECRETS_JSON;
  const prevMode = process.env.RECEIVER_AUTH_MODE;
  process.env.RECEIVER_SECRETS_JSON = JSON.stringify({
    "tenant-a": "secret-a-value",
  });
  process.env.RECEIVER_AUTH_MODE = "api_key";

  const config = {
    id: "cfg1",
    tenantId: "tenant-a",
    baseUrl: "https://receiver.example.com",
    status: "ACTIVE" as const,
    sourceName: "indeed-receiver",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // A — auth headers per tenant corretto
  try {
    const headers = await buildReceiverAuthHeaders({
      tenantId: "tenant-a",
      method: "GET",
      path: "/v1/tenants/tenant-a/applications",
    });
    const ok =
      headers["X-Credixa-Tenant-Id"] === "tenant-a" &&
      headers["X-Receiver-Key"] === "secret-a-value";
    record("A. tenant corretto → richiesta autenticata", ok);
  } catch (e) {
    record("A. tenant corretto → richiesta autenticata", false, String(e));
  }

  // B — tenant senza secret
  try {
    await buildReceiverAuthHeaders({
      tenantId: "tenant-b",
      method: "GET",
      path: "/x",
    });
    record("B. tenant errato → rifiutato", false, "nessun errore");
  } catch (e) {
    const ok =
      e instanceof ReceiverClientError && e.code === "AUTH_FAILED";
    record("B. tenant errato → rifiutato", ok, ok ? e.code : String(e));
  }

  // C — offline
  try {
    await listApplications("tenant-a", "job-1", {
      getConfig: async () => config,
      fetch: async () => {
        throw new TypeError("fetch failed");
      },
      production: true,
    });
    record("C. Receiver offline → errore controllato", false);
  } catch (e) {
    const ok = e instanceof ReceiverClientError && e.code === "OFFLINE";
    record("C. Receiver offline → errore controllato", ok, ok ? e.code : String(e));
  }

  // D — timeout
  try {
    await getSyncStatus("tenant-a", {
      getConfig: async () => config,
      fetch: async () => {
        const err = new Error("aborted");
        err.name = "TimeoutError";
        throw err;
      },
      production: true,
    });
    record("D. timeout → errore controllato", false);
  } catch (e) {
    const ok = e instanceof ReceiverClientError && e.code === "TIMEOUT";
    record("D. timeout → errore controllato", ok, ok ? e.code : String(e));
  }

  // E — DTO normalizzato
  try {
    const candidate = await getApplication("tenant-a", "rc-1", {
      getConfig: async () => config,
      production: true,
      fetch: async () =>
        new Response(
          JSON.stringify({
            receiverCandidateId: "rc-1",
            externalApplicationId: "app-9",
            indeedJobId: "job-1",
            firstName: "Luca",
            lastName: "Verdi",
            email: "luca@example.com",
            phone: "+39 111",
            coverLetter: "Ciao",
            resumeMeta: {
              present: true,
              fileName: "cv.pdf",
              contentType: "application/pdf",
              documentId: "doc-1",
              sizeBytes: 1024,
            },
            cvRef: "receiver://docs/doc-1",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        ),
    });
    const ok =
      candidate.receiverCandidateId === "rc-1" &&
      candidate.externalApplicationId === "app-9" &&
      candidate.firstName === "Luca" &&
      candidate.resumeMeta?.fileName === "cv.pdf" &&
      candidate.cvRef === "receiver://docs/doc-1";
    record("E. candidatura valida → DTO normalizzato", ok);
  } catch (e) {
    record("E. candidatura valida → DTO normalizzato", false, String(e));
  }

  // F — CV solo openUrl
  try {
    const cv = await getCvOpenUrl("tenant-a", "rc-1", {
      getConfig: async () => config,
      production: true,
      fetch: async () =>
        new Response(
          JSON.stringify({
            openUrl: "https://receiver.example.com/tmp/cv?sig=abc",
            expiresAt: "2099-01-01T00:00:00Z",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        ),
    });
    const json = JSON.stringify(cv);
    const ok =
      cv.openUrl.startsWith("https://") &&
      !json.includes("base64") &&
      !("data" in cv) &&
      !("content" in cv);
    record("F. CV → solo cvRef/URL temporaneo", ok);
  } catch (e) {
    record("F. CV → solo cvRef/URL temporaneo", false, String(e));
  }

  // Fbis — rifiuta contenuto CV nella risposta open
  try {
    await getCvOpenUrl("tenant-a", "rc-1", {
      getConfig: async () => config,
      production: true,
      fetch: async () =>
        new Response(
          JSON.stringify({
            openUrl: "https://receiver.example.com/tmp/cv",
            base64: "AAAA",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        ),
    });
    record("F2. CV con base64 → rifiutato", false);
  } catch (e) {
    const ok =
      e instanceof ReceiverClientError && e.code === "INVALID_RESPONSE";
    record("F2. CV con base64 → rifiutato", ok, ok ? e.code : String(e));
  }

  // G — HTTP in produzione rifiutato
  try {
    assertReceiverRequestBaseUrl("http://receiver.example.com", {
      production: true,
    });
    record("G. URL non HTTPS in produzione → rifiutato", false);
  } catch (e) {
    const ok =
      e instanceof ReceiverClientError && e.code === "HTTPS_REQUIRED";
    record(
      "G. URL non HTTPS in produzione → rifiutato",
      ok,
      ok ? e.code : String(e)
    );
  }

  // H — secret non in codice client / NEXT_PUBLIC
  try {
    const authSrc = readFileSync(
      resolve("src/lib/recruiting/receiverAuth.ts"),
      "utf8"
    );
    const clientHook = readFileSync(
      resolve("src/instrumentation-client.ts"),
      "utf8"
    );
    const envExample = readFileSync(resolve(".env.example"), "utf8");
    const hasServerOnly = authSrc.includes('import "server-only"');
    const secretsOnlyServer =
      envExample.includes("RECEIVER_SECRETS_JSON") &&
      !envExample.includes("NEXT_PUBLIC_RECEIVER");
    const clientClean = !clientHook.includes("RECEIVER_SECRETS");
    record(
      "H. secret non presente nel codice client",
      hasServerOnly && secretsOnlyServer && clientClean
    );
  } catch (e) {
    record("H. secret non presente nel codice client", false, String(e));
  }

  if (prevSecrets === undefined) delete process.env.RECEIVER_SECRETS_JSON;
  else process.env.RECEIVER_SECRETS_JSON = prevSecrets;
  if (prevMode === undefined) delete process.env.RECEIVER_AUTH_MODE;
  else process.env.RECEIVER_AUTH_MODE = prevMode;

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} passati`);
  if (failed.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
