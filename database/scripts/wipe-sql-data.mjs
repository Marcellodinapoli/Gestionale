/**
 * Svuota tutti i dati operativi da SQL Server (schema invariato).
 * Non reinserisce tenant demo né dati di test.
 *
 * Uso:
 *   node database/scripts/wipe-sql-data.mjs
 *   node database/scripts/wipe-sql-data.mjs --confirm
 *
 * Richiede DB_PASSWORD nel .env (o variabili connector).
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvFile() {
  for (const envPath of [resolve(process.cwd(), ".env"), resolve(process.cwd(), "connector", ".env")]) {
    if (!existsSync(envPath)) continue;
    for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i < 0) continue;
      const key = t.slice(0, i).trim();
      let val = t.slice(i + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = val;
    }
  }
}

loadEnvFile();

const TABLES = [
  "DashboardKpi",
  "AuditLog",
  "ConfigurazioneSistema",
  "ImpegniAgenda",
  "MessaggiAgenda",
  "MessaggiInterni",
  "PraticheLock",
  "RegistrazioniChiamate",
  "Documenti",
  "Fatture",
  "Provvigioni",
  "Incassi",
  "Attivita",
  "PianoRate",
  "GaranteRecapiti",
  "Garanti",
  "Pratiche",
  "ImportBatch",
  "DebitoreRecapiti",
  "Debitori",
  "Mandanti",
  "PasswordHistory",
  "Users",
  "Postazioni",
  "Sedi",
  "Tenants",
];

function getConfig() {
  return {
    server: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 1433),
    database: process.env.DB_NAME || "CredixaDev",
    user: process.env.DB_USER || "credixa_dev",
    password: process.env.DB_PASSWORD || "",
    options: {
      encrypt: false,
      trustServerCertificate: true,
      ...(Number(process.env.DB_PORT || 1433)
        ? {}
        : { instanceName: process.env.DB_INSTANCE || "CREDIXA_DEV" }),
    },
  };
}

async function loadMssql() {
  try {
    return await import("mssql");
  } catch {
    console.error("Installa mssql: npm install --save-dev mssql");
    process.exit(1);
  }
}

async function countTable(pool, table) {
  const res = await pool.request().query(`
    IF OBJECT_ID('dbo.${table}', 'U') IS NOT NULL
      SELECT COUNT(*) AS n FROM dbo.${table};
    ELSE
      SELECT 0 AS n;
  `);
  return Number(res.recordset[0]?.n ?? 0);
}

async function main() {
  const confirmed = process.argv.includes("--confirm");
  if (!confirmed) {
    console.log("ATTENZIONE: questo script cancella TUTTI i dati da CredixaDev.");
    console.log("Lo schema (tabelle/indici) resta invariato.");
    console.log("");
    console.log("Per procedere:");
    console.log("  node database/scripts/wipe-sql-data.mjs --confirm");
    process.exit(0);
  }

  const config = getConfig();
  if (!config.password) {
    console.error("Imposta DB_PASSWORD nel .env (root o connector/.env)");
    process.exit(1);
  }

  const mssql = await loadMssql();
  const pool = await mssql.default.connect(config);

  console.log(`Database: ${config.database} @ ${config.server}:${config.port}`);
  console.log("Conteggio righe prima della cancellazione...\n");

  let totalBefore = 0;
  for (const table of TABLES) {
    const n = await countTable(pool, table);
    if (n > 0) console.log(`  ${table.padEnd(24)} ${n.toLocaleString("it-IT")}`);
    totalBefore += n;
  }
  console.log(`\n  TOTALE                 ${totalBefore.toLocaleString("it-IT")}\n`);

  if (totalBefore === 0) {
    console.log("Database già vuoto. Nessuna operazione necessaria.");
    await pool.close();
    return;
  }

  console.log("Cancellazione in corso...");
  for (const table of TABLES) {
    await pool.request().query(
      `IF OBJECT_ID('dbo.${table}', 'U') IS NOT NULL DELETE FROM dbo.${table};`
    );
  }

  console.log("\nVerifica post-cancellazione...\n");
  let totalAfter = 0;
  for (const table of TABLES) {
    const n = await countTable(pool, table);
    if (n > 0) console.log(`  ⚠ ${table}: ancora ${n} righe`);
    totalAfter += n;
  }

  await pool.close();

  if (totalAfter > 0) {
    console.error(`\nErrore: restano ${totalAfter} righe. Controllare vincoli FK.`);
    process.exit(1);
  }

  console.log("✓ Tutti i dati operativi sono stati cancellati.");
  console.log("  Schema SQL intatto — puoi inserire tenant, utenti e dati tuoi.");
  console.log("\nProssimi passi suggeriti:");
  console.log("  1. INSERT INTO dbo.Tenants ...");
  console.log("  2. INSERT INTO dbo.Users (admin) ...");
  console.log("  3. Avvia connector + app con DATABASE_PROVIDER=connector");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
