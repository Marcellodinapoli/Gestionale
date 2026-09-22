import { config } from "dotenv";
import { resolve } from "node:path";
import pg from "pg";
import bcrypt from "bcryptjs";

config({ path: resolve(".env") });

const c = new pg.Client({
  connectionString: process.env.NEON_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
await c.connect();

const tenant = (
  await c.query(
    `SELECT "Id", "Slug", "Nome" FROM "Tenants" WHERE lower("Slug") = 'demo' LIMIT 1`
  )
).rows[0];
console.log("tenant", tenant);

const users = (
  await c.query(
    `SELECT "Email", "Role", "PasswordHash" FROM "Users" WHERE "TenantId" = $1`,
    [tenant.Id]
  )
).rows;

for (const u of users) {
  console.log(u.Email, u.Role, "hashLen", String(u.PasswordHash || "").length);
  for (const pw of ["Demo123!", "demo123!", "Admin123!", "Pinco123!"]) {
    try {
      if (await bcrypt.compare(pw, u.PasswordHash)) {
        console.log("  MATCH", pw);
      }
    } catch {
      /* ignore */
    }
  }
}
await c.end();
