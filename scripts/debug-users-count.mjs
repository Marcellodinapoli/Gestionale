import { config } from "dotenv";
import pg from "pg";

config({ path: ".env" });

const c = new pg.Client({
  connectionString: process.env.NEON_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
await c.connect();

const tenants = (
  await c.query(
    `SELECT "Id", "Slug" FROM "Tenants" WHERE lower("Slug") IN ('dvr','demo')`
  )
).rows;

for (const row of tenants) {
  const n1 = (
    await c.query(`SELECT COUNT(*)::int AS n FROM "Users" WHERE "TenantId" = $1`, [
      row.Id,
    ])
  ).rows[0];
  const n2 = (
    await c.query(
      `SELECT COUNT(*)::int AS n FROM "Users" WHERE "TenantId" = $1::uuid`,
      [row.Id]
    )
  ).rows[0];
  const correl = (
    await c.query(
      `SELECT COUNT(*)::int AS n FROM "Users" u WHERE u."TenantId" = $1::uuid`,
      [row.Id]
    )
  ).rows[0];
  console.log(
    JSON.stringify({
      slug: row.Slug,
      id: row.Id,
      users: n1.n,
      usersUuid: n2.n,
      correl: correl.n,
    })
  );

  const cfg = (
    await c.query(
      `SELECT "Chiave", "Valore" FROM "ConfigurazioneSistema"
       WHERE "TenantId" = $1::uuid AND "Chiave" LIKE 'platform.%'`,
      [row.Id]
    )
  ).rows;
  for (const r of cfg) {
    console.log("  ", r.Chiave, String(r.Valore).slice(0, 300));
  }
}

const typeofUsers = (
  await c.query(
    `SELECT pg_typeof("TenantId")::text AS t, "TenantId"::text AS sample
     FROM "Users" LIMIT 1`
  )
).rows[0];
const typeofTenants = (
  await c.query(
    `SELECT pg_typeof("Id")::text AS t FROM "Tenants" LIMIT 1`
  )
).rows[0];
console.log({ typeofUsers, typeofTenants });

await c.end();
