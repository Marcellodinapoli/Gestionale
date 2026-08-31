/**
 * Esegue le migrazioni SQL in ordine su CredixaDev.
 * Richiede: npm install mssql (devDependency root) oppure variabile MSSQL_CONNECTION_STRING.
 *
 * Uso:
 *   node database/scripts/run-migrations.mjs
 *   node database/scripts/run-migrations.mjs --host=localhost --port=1433 --user=credixa_dev --password=...
 */
import { readdir, readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dirname, "..", "migrations");

function parseArgs() {
  const out = {};
  for (const arg of process.argv.slice(2)) {
    const m = arg.match(/^--([^=]+)(?:=(.*))?$/);
    if (m) out[m[1]] = m[2] ?? "1";
  }
  return out;
}

function getConfig(args) {
  if (process.env.MSSQL_CONNECTION_STRING) {
    return { connectionString: process.env.MSSQL_CONNECTION_STRING };
  }
  return {
    server: args.host || process.env.DB_HOST || "localhost",
    port: Number(args.port || process.env.DB_PORT || 1433),
    database: args.database || process.env.DB_NAME || "CredixaDev",
    user: args.user || process.env.DB_USER || "credixa_dev",
    password: args.password || process.env.DB_PASSWORD || "",
    options: {
      encrypt: false,
      trustServerCertificate: true,
      // Porta statica 1433: non usare instanceName (SQL Browser disabilitato)
      ...(Number(process.env.DB_PORT || args.port || 1433) ? {} : {
        instanceName: process.env.DB_INSTANCE || "CREDIXA_DEV",
      }),
    },
  };
}

async function loadMssql() {
  try {
    return await import("mssql");
  } catch {
    console.error(
      "Pacchetto 'mssql' non trovato. Esegui: npm install --save-dev mssql"
    );
    process.exit(1);
  }
}

function splitBatches(sql) {
  return sql
    .split(/^\s*GO\s*$/gim)
    .map((b) => b.trim())
    .filter(Boolean);
}

async function main() {
  const args = parseArgs();
  const mssql = await loadMssql();
  const config = getConfig(args);

  if (!config.connectionString && !config.password) {
    console.error(
      "Imposta DB_PASSWORD o MSSQL_CONNECTION_STRING (o --password=...)"
    );
    process.exit(1);
  }

  console.log(`Connessione a ${config.server ?? "sql"} / ${config.database}...`);
  const pool = await mssql.default.connect(config);

  const files = (await readdir(migrationsDir))
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const path = join(migrationsDir, file);
    const sql = await readFile(path, "utf8");
    const batches = splitBatches(sql);
    console.log(`→ ${file} (${batches.length} batch)`);
    for (const batch of batches) {
      await pool.request().query(batch);
    }
  }

  await pool.close();
  console.log("Migrazioni completate.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
