import { config } from "dotenv";
import { resolve } from "node:path";
import pg from "pg";

config({ path: resolve(".env") });

const c = new pg.Client({
  connectionString: process.env.NEON_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
await c.connect();
const t = await c.query(`SELECT "Id" FROM "Tenants" LIMIT 1`);
const tid = t.rows[0].Id;
const o = await c.query(
  `SELECT "Id", "Titolo", "TenantId" FROM "OfferteLavoro" WHERE "TenantId" = $1`,
  [tid]
);
console.log("tenant", tid);
console.log("offerte by uuid tenant", o.rows);
const o2 = await c.query(`SELECT "Id", "Titolo", "TenantId" FROM "OfferteLavoro"`);
console.log("all offerte", o2.rows);
await c.end();
