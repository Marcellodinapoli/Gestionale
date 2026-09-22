import { config } from "dotenv";
import { resolve } from "node:path";
import pg from "pg";
import bcrypt from "bcryptjs";

config({ path: resolve(".env") });

const hash = await bcrypt.hash("Demo123!", 10);
const c = new pg.Client({
  connectionString: process.env.NEON_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
await c.connect();
const r = await c.query(
  `UPDATE "Users" SET "PasswordHash" = $1 WHERE lower("Email") = lower($2)`,
  [hash, "pinco@azienda.it"]
);
console.log("updated", r.rowCount);
const ok = await bcrypt.compare(
  "Demo123!",
  (
    await c.query(
      `SELECT "PasswordHash" FROM "Users" WHERE lower("Email") = lower($1)`,
      ["pinco@azienda.it"]
    )
  ).rows[0].PasswordHash
);
console.log("verify", ok);
await c.end();
