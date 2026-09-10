/**
 * Applica migrazioni 025–026 (spese giudiziali + esito).
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

const files = ["025_spese_giudiziali.sql", "026_esito_giudiziale_campi.sql"];

console.log(`Applico 025–026 su ${config.database || "connection-string"}…`);
const pool = await sql.connect(config);
try {
  for (const file of files) {
    const raw = readFileSync(join(root, "database", "migrations", file), "utf8");
    const batches = raw
      .split(/^\s*GO\s*$/gim)
      .map((b) => b.trim())
      .filter(Boolean);
    console.log(`→ ${file} (${batches.length} batch)`);
    for (const batch of batches) {
      await pool.request().batch(batch);
    }
  }
  const check = await pool.request().query(`
    SELECT
      COL_LENGTH('dbo.Pratiche', 'SpeseGiudiziali') AS SpeseGiudiziali,
      COL_LENGTH('dbo.PraticheGiudiziali', 'SpeseGiudizialiJson') AS SpeseGiudizialiJson,
      COL_LENGTH('dbo.PraticheGiudiziali', 'DataEsito') AS DataEsito,
      COL_LENGTH('dbo.PraticheGiudiziali', 'ImportoRecuperato') AS ImportoRecuperato
  `);
  console.log("Verifica:", check.recordset[0]);
  console.log("OK");
} finally {
  await pool.close();
}
