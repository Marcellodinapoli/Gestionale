/**
 * Crea tenant demo + admin minimo su SQL (dopo wipe).
 * Uso: node database/scripts/provision-minimal.mjs
 */
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import bcrypt from "bcryptjs";

const PROVISIONAL_PASSWORD = "Temp2026!";

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

async function main() {
  const mssql = await import("mssql");
  const config = {
    server: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 1433),
    database: process.env.DB_NAME || "CredixaDev",
    user: process.env.DB_USER || "credixa_dev",
    password: process.env.DB_PASSWORD || "",
    options: { encrypt: false, trustServerCertificate: true },
  };
  if (!config.password) {
    console.error("DB_PASSWORD mancante");
    process.exit(1);
  }

  const pool = await mssql.default.connect(config);
  const existing = await pool.request().query(
    `SELECT COUNT(*) AS n FROM dbo.Tenants WHERE Slug = N'demo'`
  );
  if (Number(existing.recordset[0].n) > 0) {
    console.log("Tenant 'demo' già presente — aggiorno solo password admin.");
    const tenantRes = await pool.request().query(
      `SELECT Id FROM dbo.Tenants WHERE Slug = N'demo'`
    );
    const tenantId = tenantRes.recordset[0].Id;
    const hash = await bcrypt.hash(PROVISIONAL_PASSWORD, 10);
    await pool
      .request()
      .input("hash", mssql.default.NVarChar(500), hash)
      .input("tenantId", mssql.default.UniqueIdentifier, tenantId)
      .query(`
        UPDATE dbo.Users
        SET PasswordHash = @hash, PasswordChangedAt = SYSUTCDATETIME(), Active = 1
        WHERE TenantId = @tenantId AND Email = N'admin@gestionale.local'
      `);
    await pool.close();
    printCredentials(true);
    return;
  }

  const tenantId = randomUUID();
  const sedeId = randomUUID();
  const adminId = randomUUID();
  const hash = await bcrypt.hash(PROVISIONAL_PASSWORD, 10);

  await pool
    .request()
    .input("tenantId", mssql.default.UniqueIdentifier, tenantId)
    .query(`
      INSERT INTO dbo.Tenants (Id, Slug, Nome, Active)
      VALUES (@tenantId, N'demo', N'Demo Recupero Crediti S.r.l.', 1)
    `);

  await pool
    .request()
    .input("sedeId", mssql.default.UniqueIdentifier, sedeId)
    .input("tenantId", mssql.default.UniqueIdentifier, tenantId)
    .query(`
      INSERT INTO dbo.Sedi (Id, TenantId, Nome, Active)
      VALUES (@sedeId, @tenantId, N'Sede Principale', 1)
    `);

  await pool
    .request()
    .input("adminId", mssql.default.UniqueIdentifier, adminId)
    .input("tenantId", mssql.default.UniqueIdentifier, tenantId)
    .input("sedeId", mssql.default.UniqueIdentifier, sedeId)
    .input("hash", mssql.default.NVarChar(500), hash)
    .query(`
      INSERT INTO dbo.Users (Id, TenantId, Email, Name, PasswordHash, Role, SedeId, Active)
      VALUES (@adminId, @tenantId, N'admin@gestionale.local', N'Anna Admin', @hash, N'ADMIN', @sedeId, 1)
    `);

  await pool.close();
  printCredentials(false);
}

function printCredentials(updated) {
  console.log(updated ? "\n=== Password admin aggiornata ===" : "\n=== Accesso provvisorio creato ===");
  console.log("Codice azienda:  demo");
  console.log("Email:           admin@gestionale.local");
  console.log(`Password:        ${PROVISIONAL_PASSWORD}`);
  console.log("\nAl primo login potresti vedere il wizard sedi se non ci sono altre sedi.");
  console.log("Cambiala subito da Account → Cambio password.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
