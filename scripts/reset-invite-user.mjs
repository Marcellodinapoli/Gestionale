/**
 * Reset account + inviti per ripartire da attiva-account.
 * Uso: npx tsx scripts/reset-invite-user.mjs [email]
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

const email = (process.argv[2] || "dvrdinapoli@gmail.com").trim().toLowerCase();
const { neonQuery } = await import("../src/lib/neon/pool.ts");

const users = await neonQuery(
  `SELECT "Id", "TenantId", "Email", "Role", "Active"
   FROM "Users" WHERE lower("Email") = lower($1)`,
  [email]
);
const invites = await neonQuery(
  `SELECT "Id", "TenantId", "Email", "UsedAt", "ExpiresAt", "CreatedAt"
   FROM "TenantInvites"
   WHERE lower("Email") = lower($1)
   ORDER BY "CreatedAt" DESC`,
  [email]
);
const tenants = await neonQuery(
  `SELECT "Id", "Slug", "Nome", "Status"
   FROM "Tenants"
   WHERE lower("Slug") LIKE '%dvr%' OR lower("Nome") LIKE '%dvr%'`
);

console.log("email", email);
console.log("tenants", tenants);
console.log("users", users);
console.log("invites", invites);

const delUsers = await neonQuery(
  `DELETE FROM "Users" WHERE lower("Email") = lower($1) RETURNING "Id", "TenantId", "Email"`,
  [email]
);
const delInvites = await neonQuery(
  `DELETE FROM "TenantInvites" WHERE lower("Email") = lower($1) RETURNING "Id", "TenantId", "Email"`,
  [email]
);

console.log("deleted users", delUsers);
console.log("deleted invites", delInvites);
console.log("OK: puoi reinviare l'invito da Back Office e rifare attiva-account");
