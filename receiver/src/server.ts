import path from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { createApp } from "./app.js";
import { loadSecretsFromJson, parseAuthMode } from "./auth.js";
import { ApplicationStore } from "./store/applicationStore.js";
import { LocalDocumentStorage } from "./storage/localDocumentStorage.js";

/** Carica receiver/.env in process.env se presente (tsx non lo fa da solo). */
function loadDotEnv() {
  const envPath = path.resolve(process.cwd(), ".env");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 0) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}

loadDotEnv();

function env(name: string, fallback = ""): string {
  return String(process.env[name] ?? fallback).trim();
}

export function buildReceiverFromEnv(overrides?: {
  storageRoot?: string;
  publicBaseUrl?: string;
  port?: number;
  maxCvSizeBytes?: number;
}) {
  const storageRoot =
    overrides?.storageRoot ||
    env("RECEIVER_STORAGE_ROOT", path.join(process.cwd(), "data", "storage"));
  const publicBaseUrl =
    overrides?.publicBaseUrl ||
    env("RECEIVER_PUBLIC_BASE_URL", "http://127.0.0.1:3040");
  const signingSecret =
    env("RECEIVER_TMP_SIGNING_SECRET") || "dev-tmp-signing-secret";

  const storage = new LocalDocumentStorage(
    storageRoot,
    publicBaseUrl,
    signingSecret
  );
  const persistPath =
    env("RECEIVER_STORE_PATH") ||
    path.join(process.cwd(), "data", "applications-store.json");
  const store = new ApplicationStore(storage, { persistPath });
  const auth = {
    mode: parseAuthMode(env("RECEIVER_AUTH_MODE", "api_key")),
    secrets: loadSecretsFromJson(env("RECEIVER_SECRETS_JSON")),
  };
  const sourceAuth = {
    mode: parseAuthMode(env("RECEIVER_SOURCE_AUTH_MODE", "api_key")),
    secrets: loadSecretsFromJson(env("RECEIVER_SOURCE_SECRETS_JSON")),
  };
  const maxCvSizeBytes =
    overrides?.maxCvSizeBytes ??
    (Number(env("MAX_CV_SIZE_BYTES", String(5 * 1024 * 1024))) ||
      5 * 1024 * 1024);

  const app = createApp({
    store,
    storage,
    auth,
    sourceAuth,
    maxCvSizeBytes,
  });
  return { app, store, storage, auth, sourceAuth, maxCvSizeBytes };
}

async function main() {
  const port = Number(env("PORT", "3040")) || 3040;
  const publicBaseUrl = env(
    "RECEIVER_PUBLIC_BASE_URL",
    `http://127.0.0.1:${port}`
  );
  const { app } = buildReceiverFromEnv({ publicBaseUrl });
  app.listen(port, () => {
    console.info(
      JSON.stringify({
        event: "receiver_listen",
        port,
      })
    );
  });
}

const isDirect =
  process.argv[1] &&
  (process.argv[1].endsWith("server.ts") ||
    process.argv[1].endsWith("server.js"));

if (isDirect) {
  void main();
}
