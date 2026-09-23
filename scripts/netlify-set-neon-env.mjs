/**
 * Imposta su Netlify DATABASE_PROVIDER=neon e NEON_DATABASE_URL
 * (legge .env locale; non stampa la connection string).
 *
 * Uso:
 *   NETLIFY_AUTH_TOKEN=... NETLIFY_SITE_ID=... node scripts/netlify-set-neon-env.mjs
 *
 * Oppure: netlify login && netlify link, poi lo stesso script.
 */
import "dotenv/config";
import { readFileSync, existsSync } from "node:fs";

function readNetlifySiteId() {
  if (process.env.NETLIFY_SITE_ID) return process.env.NETLIFY_SITE_ID.trim();
  const statePath = ".netlify/state.json";
  if (existsSync(statePath)) {
    try {
      const j = JSON.parse(readFileSync(statePath, "utf8"));
      if (j.siteId) return String(j.siteId);
    } catch {
      /* ignore */
    }
  }
  return "";
}

const token = (process.env.NETLIFY_AUTH_TOKEN || "").trim();
const siteId = readNetlifySiteId();
const neonUrl = (process.env.NEON_DATABASE_URL || "").trim();

if (!token) {
  console.error("Manca NETLIFY_AUTH_TOKEN (User settings → Applications → Personal access tokens).");
  process.exit(1);
}
if (!siteId) {
  console.error("Manca NETLIFY_SITE_ID (Site settings → Site details → Site ID), oppure esegui: npx netlify link");
  process.exit(1);
}
if (!neonUrl) {
  console.error("Manca NEON_DATABASE_URL in .env");
  process.exit(1);
}

async function upsertEnv(key, value) {
  const listRes = await fetch(`https://api.netlify.com/api/v1/sites/${siteId}/env`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!listRes.ok) {
    throw new Error(`List env failed: ${listRes.status} ${await listRes.text()}`);
  }
  const envs = await listRes.json();
  const existing = Array.isArray(envs) ? envs.find((e) => e.key === key) : null;

  if (existing?.id) {
    const res = await fetch(`https://api.netlify.com/api/v1/accounts/${existing.account_id || "me"}/env/${key}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        key,
        values: [{ value, context: "all" }],
      }),
    });
    // Fallback site-scoped update
    if (!res.ok) {
      const res2 = await fetch(`https://api.netlify.com/api/v1/sites/${siteId}/env/${key}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ value }),
      });
      if (!res2.ok) {
        throw new Error(`Update ${key} failed: ${res.status}/${res2.status}`);
      }
    }
    console.log(`updated ${key}`);
    return;
  }

  const create = await fetch(`https://api.netlify.com/api/v1/sites/${siteId}/env`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      key,
      values: [{ value, context: "all" }],
    }),
  });
  if (!create.ok) {
    // API v2 style
    const create2 = await fetch(`https://api.netlify.com/api/v1/sites/${siteId}/env/${key}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ value }),
    });
    if (!create2.ok) {
      throw new Error(`Create ${key} failed: ${create.status} ${await create.text()}`);
    }
  }
  console.log(`created ${key}`);
}

await upsertEnv("DATABASE_PROVIDER", "neon");
await upsertEnv("NEON_DATABASE_URL", neonUrl);
console.log("OK — ridistribuisci il sito (Deploys → Trigger deploy) dopo queste variabili.");
