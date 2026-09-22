import { config } from "dotenv";
import { resolve } from "node:path";
import pg from "pg";

config({ path: resolve(".env") });
const c = new pg.Client({
  connectionString: process.env.NEON_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
await c.connect();
const q = async (sql) => (await c.query(sql)).rows;
const tables = await q(
  "select count(*)::int as n from information_schema.tables where table_schema='public'"
);
const tenants = await q('select "Slug","Nome" from "Tenants"');
const users = await q('select "Email","Role","Active" from "Users"');
const pratiche = await q('select count(*)::int as n from "Pratiche"');
console.log({
  tables: tables[0].n,
  tenants,
  users,
  pratiche: pratiche[0].n,
});
await c.end();
