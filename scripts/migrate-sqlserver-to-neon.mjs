/**
 * Migra schema + dati da SQL Server (CredixaDev) a Neon Postgres.
 * Non tocca Formazione/Firebase. Non modifica SQL Server (solo lettura).
 *
 * Uso: node scripts/migrate-sqlserver-to-neon.mjs
 * Opzioni:
 *   --dry-run     solo inventario + DDL (nessuna scrittura su Neon)
 *   --wipe-neon   DROP CASCADE di tutte le tabelle public prima di ricreare
 */
import { config } from "dotenv";
import { resolve } from "node:path";
import sql from "mssql";
import pg from "pg";

config({ path: resolve("connector/.env") });
config({ path: resolve(".env") });

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const wipeNeon = args.has("--wipe-neon");

const neonUrl = (
  process.env.NEON_DATABASE_URL ||
  process.env.DATABASE_URL_NEON ||
  ""
).trim();
if (!neonUrl || neonUrl.startsWith("file:")) {
  console.error("NEON_DATABASE_URL mancante o non Postgres.");
  process.exit(1);
}

function mapType(dataType, maxLen, precision, scale) {
  const t = String(dataType || "").toLowerCase();
  if (t === "uniqueidentifier") return "UUID";
  if (t === "bit") return "BOOLEAN";
  if (t === "datetime" || t === "datetime2" || t === "smalldatetime")
    return "TIMESTAMPTZ";
  if (t === "date") return "DATE";
  if (t === "time") return "TIME";
  if (t === "int") return "INTEGER";
  if (t === "bigint") return "BIGINT";
  if (t === "smallint") return "SMALLINT";
  if (t === "tinyint") return "SMALLINT";
  if (t === "float" || t === "real") return "DOUBLE PRECISION";
  if (t === "money" || t === "smallmoney") return "NUMERIC(19,4)";
  if (t === "decimal" || t === "numeric") {
    const p = precision || 18;
    const s = scale ?? 2;
    return `NUMERIC(${p},${s})`;
  }
  if (t === "nvarchar" || t === "varchar" || t === "nchar" || t === "char") {
    if (maxLen === -1 || maxLen == null) return "TEXT";
    return `VARCHAR(${maxLen})`;
  }
  if (t === "ntext" || t === "text") return "TEXT";
  if (t === "varbinary" || t === "binary" || t === "image") return "BYTEA";
  if (t === "xml") return "TEXT";
  return "TEXT";
}

function quoteIdent(name) {
  return `"${String(name).replace(/"/g, '""')}"`;
}

function toPgValue(val, pgType) {
  if (val === null || val === undefined) return null;
  if (pgType === "BOOLEAN") {
    if (typeof val === "boolean") return val;
    return val === 1 || val === true || val === "1" || val === "true";
  }
  if (pgType === "UUID") {
    return String(val).toLowerCase();
  }
  if (val instanceof Date) return val.toISOString();
  if (Buffer.isBuffer(val)) return val;
  return val;
}

async function main() {
  console.log("SQL Server → Neon migration");
  console.log(dryRun ? "MODE: dry-run" : "MODE: write");

  const mssqlCfg = {
    server: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 1433),
    database: process.env.DB_NAME || "CredixaDev",
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    options: {
      encrypt: false,
      trustServerCertificate: true,
      enableArithAbort: true,
    },
    connectionTimeout: 20000,
    requestTimeout: 300000,
  };

  const mssqlPool = await sql.connect(mssqlCfg);
  const pgClient = new pg.Client({
    connectionString: neonUrl,
    ssl: { rejectUnauthorized: false },
  });
  await pgClient.connect();

  const tablesRes = await mssqlPool.request().query(`
    SELECT t.name AS table_name
    FROM sys.tables t
    INNER JOIN sys.schemas s ON s.schema_id = t.schema_id
    WHERE s.name = 'dbo' AND t.is_ms_shipped = 0
    ORDER BY t.name
  `);
  const tableNames = tablesRes.recordset.map((r) => r.table_name);
  console.log(`Tabelle: ${tableNames.length}`);

  // Columns
  const colsRes = await mssqlPool.request().query(`
    SELECT c.TABLE_NAME, c.COLUMN_NAME, c.ORDINAL_POSITION,
           c.DATA_TYPE, c.CHARACTER_MAXIMUM_LENGTH,
           c.NUMERIC_PRECISION, c.NUMERIC_SCALE,
           c.IS_NULLABLE, c.COLUMN_DEFAULT
    FROM INFORMATION_SCHEMA.COLUMNS c
    INNER JOIN INFORMATION_SCHEMA.TABLES t
      ON t.TABLE_SCHEMA = c.TABLE_SCHEMA AND t.TABLE_NAME = c.TABLE_NAME
    WHERE c.TABLE_SCHEMA = 'dbo' AND t.TABLE_TYPE = 'BASE TABLE'
    ORDER BY c.TABLE_NAME, c.ORDINAL_POSITION
  `);

  /** @type {Map<string, Array<any>>} */
  const columnsByTable = new Map();
  for (const row of colsRes.recordset) {
    const list = columnsByTable.get(row.TABLE_NAME) || [];
    list.push(row);
    columnsByTable.set(row.TABLE_NAME, list);
  }

  // Primary keys
  const pkRes = await mssqlPool.request().query(`
    SELECT tc.TABLE_NAME, kcu.COLUMN_NAME, kcu.ORDINAL_POSITION
    FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
    JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
      ON tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
     AND tc.TABLE_SCHEMA = kcu.TABLE_SCHEMA
    WHERE tc.CONSTRAINT_TYPE = 'PRIMARY KEY' AND tc.TABLE_SCHEMA = 'dbo'
    ORDER BY tc.TABLE_NAME, kcu.ORDINAL_POSITION
  `);
  /** @type {Map<string, string[]>} */
  const pkByTable = new Map();
  for (const row of pkRes.recordset) {
    const list = pkByTable.get(row.TABLE_NAME) || [];
    list.push(row.COLUMN_NAME);
    pkByTable.set(row.TABLE_NAME, list);
  }

  // Foreign keys (for order + recreate)
  const fkRes = await mssqlPool.request().query(`
    SELECT
      fk.name AS fk_name,
      tp.name AS parent_table,
      cp.name AS parent_column,
      tr.name AS ref_table,
      cr.name AS ref_column
    FROM sys.foreign_keys fk
    INNER JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
    INNER JOIN sys.tables tp ON tp.object_id = fkc.parent_object_id
    INNER JOIN sys.columns cp ON cp.object_id = fkc.parent_object_id AND cp.column_id = fkc.parent_column_id
    INNER JOIN sys.tables tr ON tr.object_id = fkc.referenced_object_id
    INNER JOIN sys.columns cr ON cr.object_id = fkc.referenced_object_id AND cr.column_id = fkc.referenced_column_id
    INNER JOIN sys.schemas sp ON sp.schema_id = tp.schema_id
    WHERE sp.name = 'dbo'
    ORDER BY fk.name, fkc.constraint_column_id
  `);

  /** @type {Map<string, Set<string>>} */
  const deps = new Map(); // table -> set of tables it depends on
  for (const name of tableNames) deps.set(name, new Set());
  for (const row of fkRes.recordset) {
    if (row.parent_table === row.ref_table) continue; // self-ref later
    deps.get(row.parent_table)?.add(row.ref_table);
  }

  // Topological sort
  const ordered = [];
  const remaining = new Set(tableNames);
  while (remaining.size) {
    let progressed = false;
    for (const t of [...remaining]) {
      const need = [...(deps.get(t) || [])].filter((d) => remaining.has(d));
      if (need.length === 0) {
        ordered.push(t);
        remaining.delete(t);
        progressed = true;
      }
    }
    if (!progressed) {
      // cycle / leftover — append rest
      ordered.push(...remaining);
      remaining.clear();
    }
  }
  console.log("Ordine carico:", ordered.join(", "));

  if (dryRun) {
    for (const table of ordered) {
      const cols = columnsByTable.get(table) || [];
      console.log(`\n-- ${table}`);
      for (const c of cols) {
        console.log(
          `  ${c.COLUMN_NAME} ${mapType(c.DATA_TYPE, c.CHARACTER_MAXIMUM_LENGTH, c.NUMERIC_PRECISION, c.NUMERIC_SCALE)} ${c.IS_NULLABLE === "YES" ? "NULL" : "NOT NULL"}`
        );
      }
    }
    await mssqlPool.close();
    await pgClient.end();
    console.log("\nDry-run completato (nessuna scrittura).");
    return;
  }

  if (wipeNeon) {
    console.log("Wipe Neon public tables...");
    await pgClient.query(`
      DO $$ DECLARE r RECORD;
      BEGIN
        FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
          EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(r.tablename) || ' CASCADE';
        END LOOP;
      END $$;
    `);
  }

  // Create tables without FKs first
  for (const table of ordered) {
    const cols = columnsByTable.get(table) || [];
    const pk = pkByTable.get(table) || [];
    const colDefs = cols.map((c) => {
      const pgType = mapType(
        c.DATA_TYPE,
        c.CHARACTER_MAXIMUM_LENGTH,
        c.NUMERIC_PRECISION,
        c.NUMERIC_SCALE
      );
      const nullSql = c.IS_NULLABLE === "YES" ? "NULL" : "NOT NULL";
      return `${quoteIdent(c.COLUMN_NAME)} ${pgType} ${nullSql}`;
    });
    if (pk.length) {
      colDefs.push(
        `PRIMARY KEY (${pk.map((c) => quoteIdent(c)).join(", ")})`
      );
    }
    const ddl = `CREATE TABLE IF NOT EXISTS ${quoteIdent(table)} (\n  ${colDefs.join(",\n  ")}\n)`;
    console.log(`CREATE ${table}`);
    await pgClient.query(ddl);
  }

  // Copy data (tabelle create senza FK; ordine topologico rispetta le dipendenze)
  // Neon non consente session_replication_role.
  let totalRows = 0;
  for (const table of ordered) {
    const cols = columnsByTable.get(table) || [];
    const colNames = cols.map((c) => c.COLUMN_NAME);
    const pgTypes = cols.map((c) =>
      mapType(
        c.DATA_TYPE,
        c.CHARACTER_MAXIMUM_LENGTH,
        c.NUMERIC_PRECISION,
        c.NUMERIC_SCALE
      )
    );

    const data = await mssqlPool
      .request()
      .query(
        `SELECT ${colNames.map((c) => `[${c}]`).join(", ")} FROM dbo.[${table}]`
      );
    const rows = data.recordset;
    if (!rows.length) {
      console.log(`  ${table}: 0`);
      continue;
    }

    // Clear target table so re-runs are idempotent
    await pgClient.query(`TRUNCATE TABLE ${quoteIdent(table)} CASCADE`);

    const placeholders = colNames
      .map((_, i) => `$${i + 1}`)
      .join(", ");
    const insertSql = `INSERT INTO ${quoteIdent(table)} (${colNames
      .map(quoteIdent)
      .join(", ")}) VALUES (${placeholders})`;

    let n = 0;
    for (const row of rows) {
      const values = colNames.map((name, i) =>
        toPgValue(row[name], pgTypes[i])
      );
      await pgClient.query(insertSql, values);
      n += 1;
    }
    totalRows += n;
    console.log(`  ${table}: ${n}`);
  }

  // (FK aggiunte dopo il carico)
  // Add foreign keys (skip if already exists / best effort)
  console.log("FK...");
  const fkGrouped = new Map();
  for (const row of fkRes.recordset) {
    const key = row.fk_name;
    const g = fkGrouped.get(key) || {
      name: row.fk_name,
      parent: row.parent_table,
      ref: row.ref_table,
      parentCols: [],
      refCols: [],
    };
    g.parentCols.push(row.parent_column);
    g.refCols.push(row.ref_column);
    fkGrouped.set(key, g);
  }
  for (const fk of fkGrouped.values()) {
    const ddl = `
      ALTER TABLE ${quoteIdent(fk.parent)}
      DROP CONSTRAINT IF EXISTS ${quoteIdent(fk.name)};
      ALTER TABLE ${quoteIdent(fk.parent)}
      ADD CONSTRAINT ${quoteIdent(fk.name)}
      FOREIGN KEY (${fk.parentCols.map(quoteIdent).join(", ")})
      REFERENCES ${quoteIdent(fk.ref)} (${fk.refCols.map(quoteIdent).join(", ")});
    `;
    try {
      await pgClient.query(ddl);
      console.log(`  FK ${fk.name}`);
    } catch (err) {
      console.warn(`  FK skip ${fk.name}:`, err.message);
    }
  }

  // Verify counts
  console.log("\nVerifica conteggi:");
  let ok = true;
  for (const table of ordered) {
    const src = await mssqlPool
      .request()
      .query(`SELECT COUNT(*) AS c FROM dbo.[${table}]`);
    const dst = await pgClient.query(
      `SELECT COUNT(*)::int AS c FROM ${quoteIdent(table)}`
    );
    const a = Number(src.recordset[0].c);
    const b = Number(dst.rows[0].c);
    const mark = a === b ? "OK" : "DIFF";
    if (a !== b) ok = false;
    console.log(`  ${mark} ${table}: sql=${a} neon=${b}`);
  }

  await mssqlPool.close();
  await pgClient.end();

  console.log(`\nRighe copiate: ${totalRows}`);
  console.log(ok ? "MIGRAZIONE OK" : "MIGRAZIONE CON DIFFERENZE");
  console.log("Formazione/Firebase: non coinvolti. SQL Server: solo lettura.");
  if (!ok) process.exit(2);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
