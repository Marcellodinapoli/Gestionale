/**
 * Reimposta la password dell'admin demo su SQL Server (connector).
 * Uso: node scripts/reset-admin-password.mjs [password]
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
import mssql from "mssql";

const __dirname = dirname(fileURLToPath(import.meta.url));
const password = process.argv[2] || "Demo123!";

function loadConnectorEnv() {
  const envPath = resolve(__dirname, "../connector/.env");
  const raw = readFileSync(envPath, "utf8");
  const env = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) env[m[1].trim()] = m[2].trim();
  }
  return env;
}

const env = loadConnectorEnv();
const config = {
  server: env.DB_HOST || "localhost",
  port: Number(env.DB_PORT || 1433),
  database: env.DB_NAME || "CredixaDev",
  user: env.DB_USER || "credixa_dev",
  password: env.DB_PASSWORD || "",
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
};

if (!config.password) {
  console.error("DB_PASSWORD mancante in connector/.env");
  process.exit(1);
}

const pool = await mssql.connect(config);
const passwordHash = await bcrypt.hash(password, 10);
const result = await pool
  .request()
  .input("email", mssql.NVarChar, "admin@gestionale.local")
  .input("slug", mssql.NVarChar, "demo")
  .input("passwordHash", mssql.NVarChar, passwordHash)
  .query(`
    UPDATE u
    SET PasswordHash = @passwordHash, PasswordChangedAt = SYSUTCDATETIME()
    FROM dbo.Users u
    INNER JOIN dbo.Tenants t ON t.Id = u.TenantId
    WHERE u.Email = @email AND t.Slug = @slug
  `);

const rows = result.rowsAffected?.[0] ?? 0;
await pool.close();

if (rows === 0) {
  console.error("Utente non trovato: tenant demo / admin@gestionale.local");
  process.exit(1);
}

console.log(`Password reimpostata per admin@gestionale.local (tenant demo): ${password}`);
