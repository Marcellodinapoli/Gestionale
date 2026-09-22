/**
 * Inventario tabelle SQL Server CredixaDev.
 * Uso: node scripts/sqlserver-inventory.mjs
 */
import { config } from "dotenv";
import { resolve } from "node:path";
import sql from "mssql";

config({ path: resolve("connector/.env") });

const cfg = {
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
  requestTimeout: 120000,
};

console.log("Connecting", cfg.server, cfg.port, cfg.database);
const pool = await sql.connect(cfg);

const tables = await pool.request().query(`
  SELECT t.name AS table_name,
         SUM(p.rows) AS row_count
  FROM sys.tables t
  INNER JOIN sys.partitions p ON p.object_id = t.object_id AND p.index_id IN (0, 1)
  INNER JOIN sys.schemas s ON s.schema_id = t.schema_id
  WHERE s.name = 'dbo' AND t.is_ms_shipped = 0
  GROUP BY t.name
  ORDER BY t.name
`);

let total = 0;
for (const r of tables.recordset) {
  const n = Number(r.row_count || 0);
  total += n;
  console.log(String(n).padStart(10), r.table_name);
}
console.log("TOTAL_TABLES", tables.recordset.length);
console.log("TOTAL_ROWS", total);

await pool.close();
