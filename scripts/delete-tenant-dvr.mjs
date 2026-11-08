/**
 * Elimina tenant dvr (e dati collegati minimi).
 * Uso: npx tsx scripts/delete-tenant-dvr.mjs
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Module from "node:module";

const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "server-only") return {};
  return originalLoad.apply(this, arguments);
};

function loadEnv() {
  try {
    const env = readFileSync(resolve(".env"), "utf8");
    for (const line of env.split(/\r?\n/)) {
      const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
      if (!m || process.env[m[1]]) continue;
      process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
    }
  } catch {
    /* ignore */
  }
}

loadEnv();

const slug = (process.argv[2] || "dvr").trim().toLowerCase();
const { neonQuery } = await import("../src/lib/neon/pool.ts");

const rows = await neonQuery(
  `SELECT "Id", "Slug", "Nome", "Status" FROM "Tenants" WHERE lower("Slug") = lower($1) LIMIT 1`,
  [slug]
);
if (!rows[0]) {
  console.log("Nessun tenant con slug", slug);
  process.exit(0);
}
const t = rows[0];
const id = String(t.Id);
console.log("Deleting", t);

await neonQuery(`DELETE FROM "TenantInvites" WHERE "TenantId" = $1::uuid`, [id]);
await neonQuery(`DELETE FROM "Users" WHERE "TenantId" = $1::uuid`, [id]);
await neonQuery(`DELETE FROM "ConfigurazioneSistema" WHERE "TenantId" = $1::uuid`, [id]).catch(
  () => undefined
);
await neonQuery(`DELETE FROM "Tenants" WHERE "Id" = $1::uuid`, [id]);
console.log("OK eliminato", slug, id);
