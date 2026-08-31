/**
 * Seed parametrico SQL Server — dati DEMO per performance testing.
 *
 * Uso:
 *   node database/seed/seed-sql-dev.mjs
 *   node database/seed/seed-sql-dev.mjs --pratiche=10000 --incassi=20000 --rate=30000
 *   node database/seed/seed-sql-dev.mjs --pratiche=50000 --reset
 */
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";

function parseArgs() {
  const defaults = {
    pratiche: 10_000,
    incassi: 20_000,
    attivita: 5_000,
    rate: 30_000,
    debitori: 8_000,
    utenti: 50,
    reset: false,
  };
  for (const arg of process.argv.slice(2)) {
    const m = arg.match(/^--([^=]+)(?:=(.+))?$/);
    if (!m) continue;
    const key = m[1];
    const val = m[2];
    if (key === "reset") defaults.reset = true;
    else if (key in defaults && val !== undefined) defaults[key] = Number(val);
  }
  return defaults;
}

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
      ...(Number(process.env.DB_PORT || 1433) ? {} : {
        instanceName: process.env.DB_INSTANCE || "CREDIXA_DEV",
      }),
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

const STATI = ["NUOVA", "IN_LAVORAZIONE", "PROMESSA", "INCASSO", "RESA", "INESIGIBILE"];
const COGNOMI = ["Rossi", "Bianchi", "Verdi", "Ferrari", "Romano", "Colombo", "Ricci", "Marino"];
const NOMI = ["Marco", "Luca", "Giulia", "Anna", "Paolo", "Sara", "Elena", "Davide"];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randBetween(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function euro(min, max) {
  return Number((min + Math.random() * (max - min)).toFixed(2));
}

async function main() {
  const opts = parseArgs();
  const mssql = await loadMssql();
  const config = getConfig();

  if (!config.password) {
    console.error("Imposta DB_PASSWORD nel .env");
    process.exit(1);
  }

  const pool = await mssql.default.connect(config);
  const req = pool.request();

  if (opts.reset) {
    console.log("Reset tabelle operative...");
    const tables = [
      "DashboardKpi", "AuditLog", "ConfigurazioneSistema", "ImpegniAgenda",
      "MessaggiAgenda", "MessaggiInterni", "PraticheLock", "RegistrazioniChiamate",
      "Documenti", "Fatture", "Provvigioni", "Incassi", "Attivita", "PianoRate",
      "GaranteRecapiti", "Garanti", "Pratiche", "ImportBatch", "DebitoreRecapiti",
      "Debitori", "Mandanti", "PasswordHistory", "Users", "Postazioni", "Sedi", "Tenants",
    ];
    for (const t of tables) {
      await pool.request().query(
        `IF OBJECT_ID('dbo.${t}', 'U') IS NOT NULL DELETE FROM dbo.${t};`
      );
    }
  }

  // Tenants
  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM dbo.Tenants WHERE Slug = N'demo')
      INSERT INTO dbo.Tenants (Slug, Nome) VALUES (N'demo', N'Demo Recupero Crediti S.r.l.');
    IF NOT EXISTS (SELECT 1 FROM dbo.Tenants WHERE Slug = N'alfa')
      INSERT INTO dbo.Tenants (Slug, Nome) VALUES (N'alfa', N'Alfa Credit S.p.A.');
  `);

  const tenantsRes = await pool.request().query(
    `SELECT Id, Slug FROM dbo.Tenants WHERE Slug IN (N'demo', N'alfa')`
  );
  const tenants = Object.fromEntries(tenantsRes.recordset.map((r) => [r.Slug, r.Id]));
  if (!tenants.demo || !tenants.alfa) {
    throw new Error("Tenant demo/alfa non trovati dopo insert");
  }

  const passwordHash = await bcrypt.hash("Demo123!", 10);

  // Sedi + admin demo
  const sedeDemoId = randomUUID();
  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM dbo.Sedi WHERE TenantId = '${tenants.demo}' AND Nome = N'Sede Roma')
      INSERT INTO dbo.Sedi (Id, TenantId, Nome) VALUES ('${sedeDemoId}', '${tenants.demo}', N'Sede Roma');
  `);

  const adminId = randomUUID();
  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE TenantId = '${tenants.demo}' AND Email = N'admin@gestionale.local')
      INSERT INTO dbo.Users (Id, TenantId, Email, Name, PasswordHash, Role, SedeId)
      VALUES ('${adminId}', '${tenants.demo}', N'admin@gestionale.local', N'Anna Admin', N'${passwordHash}', N'ADMIN', '${sedeDemoId}');
  `);

  const usersRes = await pool.request().query(
    `SELECT Id, TenantId FROM dbo.Users WHERE TenantId = '${tenants.demo}'`
  );
  let userIds = usersRes.recordset.map((r) => r.Id);

  // Operatori aggiuntivi
  while (userIds.length < opts.utenti) {
    const uid = randomUUID();
    const email = `op${userIds.length}@demo.local`;
    await pool.request().query(`
      INSERT INTO dbo.Users (Id, TenantId, Email, Name, PasswordHash, Role, SedeId)
      VALUES ('${uid}', '${tenants.demo}', N'${email}', N'${pick(NOMI)} ${pick(COGNOMI)}', N'${passwordHash}', N'OPERATORE', '${sedeDemoId}');
    `);
    userIds.push(uid);
  }

  // Mandanti
  const mandanteDemoId = randomUUID();
  const mandanteAlfaId = randomUUID();
  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM dbo.Mandanti WHERE TenantId = '${tenants.demo}' AND Codice = N'BNL')
      INSERT INTO dbo.Mandanti (Id, TenantId, Codice, RagioneSociale) VALUES ('${mandanteDemoId}', '${tenants.demo}', N'BNL', N'BNL Demo');
    IF NOT EXISTS (SELECT 1 FROM dbo.Mandanti WHERE TenantId = '${tenants.alfa}' AND Codice = N'ALFA')
      INSERT INTO dbo.Mandanti (Id, TenantId, Codice, RagioneSociale) VALUES ('${mandanteAlfaId}', '${tenants.alfa}', N'ALFA', N'Alfa Mandante');
  `);

  const mandRes = await pool.request().query(`SELECT Id, TenantId FROM dbo.Mandanti`);
  const mandantiByTenant = {};
  for (const m of mandRes.recordset) {
    (mandantiByTenant[m.TenantId] ??= []).push(m.Id);
  }

  console.log(`Seed debitori: ${opts.debitori}...`);
  const debitoreIds = [];
  const batchSize = 500;
  for (let i = 0; i < opts.debitori; i += batchSize) {
    const values = [];
    for (let j = i; j < Math.min(i + batchSize, opts.debitori); j++) {
      const id = randomUUID();
      debitoreIds.push({ id, tenantId: tenants.demo });
      values.push(
        `('${id}', '${tenants.demo}', N'${pick(NOMI)}', N'${pick(COGNOMI)}', N'DMO${String(j).padStart(6, "0")}')`
      );
    }
    await pool.request().query(
      `INSERT INTO dbo.Debitori (Id, TenantId, Nome, Cognome, CodiceFiscale) VALUES ${values.join(",")};`
    );
  }

  // Debitori alfa (isolamento tenant)
  for (let k = 0; k < 50; k++) {
    const id = randomUUID();
    await pool.request().query(`
      INSERT INTO dbo.Debitori (Id, TenantId, Nome, Cognome) VALUES ('${id}', '${tenants.alfa}', N'Alfa', N'Debitore${k}');
    `);
  }

  console.log(`Seed pratiche: ${opts.pratiche}...`);
  const praticaIds = [];
  for (let i = 0; i < opts.pratiche; i += batchSize) {
    const values = [];
    for (let j = i; j < Math.min(i + batchSize, opts.pratiche); j++) {
      const id = randomUUID();
      const deb = debitoreIds[j % debitoreIds.length];
      const mand = mandantiByTenant[deb.tenantId][0];
      const op = pick(userIds);
      const capitale = euro(500, 25000);
      const interessi = euro(0, capitale * 0.15);
      const spese = euro(0, 500);
      const stato = pick(STATI);
      praticaIds.push({ id, tenantId: deb.tenantId, mandanteId: mand, userId: op });
      values.push(
        `('${id}', '${deb.tenantId}', N'P${String(j + 1).padStart(7, "0")}', '${mand}', '${deb.id}', '${op}', N'${stato}', ${capitale}, ${interessi}, ${spese}, ${euro(0, capitale)}, ${randBetween(0, 5)})`
      );
    }
    await pool.request().query(`
      INSERT INTO dbo.Pratiche (Id, TenantId, Numero, MandanteId, DebitoreId, AssegnatarioId, Stato, Capitale, Interessi, Spese, Residuo, NumeroRateScadute)
      VALUES ${values.join(",")};
    `);
  }

  // Pratiche alfa (100 per test isolamento)
  for (let k = 0; k < 100; k++) {
    const debRes = await pool.request().query(
      `SELECT TOP 1 Id FROM dbo.Debitori WHERE TenantId = '${tenants.alfa}' ORDER BY NEWID()`
    );
    const debId = debRes.recordset[0]?.Id;
    if (!debId) break;
    await pool.request().query(`
      INSERT INTO dbo.Pratiche (Id, TenantId, Numero, MandanteId, DebitoreId, Stato, Capitale, Interessi, Spese, Residuo)
      VALUES ('${randomUUID()}', '${tenants.alfa}', N'ALFA-${k}', '${mandantiByTenant[tenants.alfa][0]}', '${debId}', N'NUOVA', 1000, 0, 0, 1000);
    `);
  }

  console.log(`Seed incassi: ${opts.incassi}...`);
  for (let i = 0; i < opts.incassi; i += batchSize) {
    const values = [];
    for (let j = i; j < Math.min(i + batchSize, opts.incassi); j++) {
      const p = praticaIds[j % praticaIds.length];
      const importo = euro(50, 2000);
      values.push(
        `('${randomUUID()}', '${p.tenantId}', '${p.id}', '${p.userId}', ${importo}, DATEADD(day, -${randBetween(0, 365)}, SYSUTCDATETIME()))`
      );
    }
    await pool.request().query(`
      INSERT INTO dbo.Incassi (Id, TenantId, PraticaId, UserId, Importo, Data) VALUES ${values.join(",")};
    `);
  }

  console.log(`Seed attivita: ${opts.attivita}...`);
  for (let i = 0; i < opts.attivita; i += batchSize) {
    const values = [];
    for (let j = i; j < Math.min(i + batchSize, opts.attivita); j++) {
      const p = praticaIds[j % praticaIds.length];
      values.push(
        `('${randomUUID()}', '${p.tenantId}', '${p.id}', '${p.userId}', N'CHIAMATA', N'CONTATTATO', DATEADD(day, -${randBetween(0, 90)}, SYSUTCDATETIME()))`
      );
    }
    await pool.request().query(`
      INSERT INTO dbo.Attivita (Id, TenantId, PraticaId, UserId, Tipo, Esito, CreatedAt) VALUES ${values.join(",")};
    `);
  }

  console.log(`Seed rate: ${opts.rate}...`);
  for (let i = 0; i < opts.rate; i += batchSize) {
    const values = [];
    for (let j = i; j < Math.min(i + batchSize, opts.rate); j++) {
      const p = praticaIds[j % praticaIds.length];
      const n = (j % 12) + 1;
      values.push(
        `('${randomUUID()}', '${p.tenantId}', '${p.id}', ${n}, ${euro(50, 500)}, DATEADD(month, ${n}, SYSUTCDATETIME()), ${Math.random() > 0.7 ? 1 : 0})`
      );
    }
    await pool.request().query(`
      INSERT INTO dbo.PianoRate (Id, TenantId, PraticaId, NumeroRata, Importo, Scadenza, Pagata) VALUES ${values.join(",")};
    `);
  }

  const counts = await pool.request().query(`
    SELECT
      (SELECT COUNT(*) FROM dbo.Tenants) AS Tenants,
      (SELECT COUNT(*) FROM dbo.Users) AS Users,
      (SELECT COUNT(*) FROM dbo.Debitori) AS Debitori,
      (SELECT COUNT(*) FROM dbo.Pratiche) AS Pratiche,
      (SELECT COUNT(*) FROM dbo.Incassi) AS Incassi,
      (SELECT COUNT(*) FROM dbo.Attivita) AS Attivita,
      (SELECT COUNT(*) FROM dbo.PianoRate) AS PianoRate
  `);

  console.log("Seed completato:", counts.recordset[0]);
  await pool.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
