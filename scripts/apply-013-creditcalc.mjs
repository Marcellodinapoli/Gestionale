import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import mssql from "mssql";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const raw = readFileSync(resolve(root, "connector/.env"), "utf8");
const env = {};
for (const line of raw.split(/\r?\n/)) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim();
}

const pool = await mssql.connect({
  server: env.DB_HOST || "localhost",
  port: Number(env.DB_PORT || 1433),
  database: env.DB_NAME || "CredixaDev",
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  options: { encrypt: false, trustServerCertificate: true },
});

const sqlText = readFileSync(
  resolve(root, "database/migrations/013_alter_users_creditcalc.sql"),
  "utf8"
);
for (const batch of sqlText.split(/^\s*GO\s*$/gim)) {
  const t = batch.trim();
  if (t) await pool.request().query(t);
}

const check = await pool.request().query(`
  SELECT
    COL_LENGTH('dbo.Users', 'ConsulenteEsterno') AS ConsulenteEsterno,
    COL_LENGTH('dbo.Users', 'CreditCalcEnabled') AS CreditCalcEnabled
`);
console.log("OK", check.recordset[0]);
await pool.close();
