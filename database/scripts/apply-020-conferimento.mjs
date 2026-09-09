/**
 * Applica solo database/migrations/020_conferimento_legale.sql
 * Carica variabili da .env (root) senza dipendere da dotenv.
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const sql = require("../../connector/node_modules/mssql");

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

function loadEnvFile(path) {
  try {
    const text = readFileSync(path, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq < 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = val;
    }
  } catch {
    /* ignore */
  }
}

loadEnvFile(join(root, ".env"));
loadEnvFile(join(root, "connector", ".env"));

const config = process.env.MSSQL_CONNECTION_STRING
  ? { connectionString: process.env.MSSQL_CONNECTION_STRING }
  : {
      server: process.env.DB_HOST || "localhost",
      port: Number(process.env.DB_PORT || 1433),
      database: process.env.DB_NAME || "CredixaDev",
      user: process.env.DB_USER || "credixa_dev",
      password: process.env.DB_PASSWORD || "",
      options: {
        encrypt: false,
        trustServerCertificate: true,
      },
    };

if (!config.connectionString && !config.password) {
  console.error("Manca DB_PASSWORD / MSSQL_CONNECTION_STRING in .env");
  process.exit(1);
}

const sqlFile = join(root, "database", "migrations", "020_conferimento_legale.sql");
const raw = readFileSync(sqlFile, "utf8");
const batches = raw
  .split(/^\s*GO\s*$/gim)
  .map((b) => b.trim())
  .filter(Boolean);

console.log(
  `Applico 020_conferimento_legale.sql su ${config.database || "connection-string"}…`
);
const pool = await sql.connect(config);
try {
  for (const batch of batches) {
    await pool.request().batch(batch);
  }
  const check = await pool.request().query(`
    SELECT
      COL_LENGTH('dbo.Pratiche', 'ConferimentoTipo') AS P_Tipo,
      COL_LENGTH('dbo.Pratiche', 'DataPassaggioGiudiziale') AS P_Data,
      COL_LENGTH('dbo.Pratiche', 'ProssimaAttivitaAlloScadere') AS P_Prox,
      COL_LENGTH('dbo.ImportBatch', 'ConferimentoTipo') AS B_Tipo,
      COL_LENGTH('dbo.ImportBatch', 'DataPassaggioGiudiziale') AS B_Data,
      COL_LENGTH('dbo.ImportBatch', 'ProssimaAttivitaAlloScadere') AS B_Prox
  `);
  console.log("Colonne verificate:", check.recordset[0]);
  console.log("OK");
} finally {
  await pool.close();
}
