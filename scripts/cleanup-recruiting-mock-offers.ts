/**
 * Elimina offerte/candidature con titolo [MOCK]… (literal brackets).
 * In T-SQL LIKE, [MOCK] è character class → serve [[]MOCK]
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import sql from "mssql";

function loadEnvFile(filePath: string) {
  if (!existsSync(filePath)) return;
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 0) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}

loadEnvFile(path.resolve(".env"));
loadEnvFile(path.resolve("connector/.env"));

async function main() {
  const cfg: sql.config = {
    server: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 1433),
    database: process.env.DB_NAME || "CredixaDev",
    user: process.env.DB_USER || "credixa_dev",
    password: process.env.DB_PASSWORD || "",
    options: { encrypt: false, trustServerCertificate: true },
  };
  const pool = await sql.connect(cfg);

  const offerte = await pool.request().query(`
    SELECT Id, TenantId, Titolo, Stato
    FROM dbo.OfferteLavoro
    WHERE Titolo LIKE N'[[]MOCK]%'
       OR Titolo LIKE N'%[[]MOCK]%'
  `);
  const offertaIds = offerte.recordset.map((r) => String(r.Id));

  const candReq = pool.request();
  let candSql = `
    SELECT Id FROM dbo.RecruitingCandidature
    WHERE Source IN (N'mock', N'percorso')
  `;
  if (offertaIds.length) {
    offertaIds.forEach((id, i) =>
      candReq.input(`o${i}`, sql.NVarChar(64), id)
    );
    candSql += ` OR OffertaId IN (${offertaIds.map((_, i) => `@o${i}`).join(",")})`;
  }
  const candidature = await candReq.query(candSql);
  const candIds = candidature.recordset.map((r) => String(r.Id));

  if (candIds.length) {
    const del = pool.request();
    candIds.forEach((id, i) => del.input(`c${i}`, sql.NVarChar(64), id));
    const inList = candIds.map((_, i) => `@c${i}`).join(",");
    await del.query(`
      DELETE FROM dbo.RecruitingAttivita WHERE CandidaturaId IN (${inList});
      DELETE FROM dbo.RecruitingColloqui WHERE CandidaturaId IN (${inList});
      DELETE FROM dbo.RecruitingCandidature WHERE Id IN (${inList});
    `);
  }

  if (offertaIds.length) {
    const delO = pool.request();
    offertaIds.forEach((id, i) => delO.input(`o${i}`, sql.NVarChar(64), id));
    await delO.query(
      `DELETE FROM dbo.OfferteLavoro WHERE Id IN (${offertaIds
        .map((_, i) => `@o${i}`)
        .join(",")})`
    );
  }

  // anche sync Firebase legacy mock se presenti
  try {
    const { removeOffertaFromCreditCoreSafe } = await import(
      "../src/lib/recruiting/creditCoreOfferteSync.ts"
    );
    for (const row of offerte.recordset) {
      await removeOffertaFromCreditCoreSafe(
        String(row.TenantId),
        String(row.Id)
      );
    }
  } catch {
    /* Firebase opzionale */
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        database: cfg.database,
        offerteTrovate: offerte.recordset.map((r) => ({
          titolo: r.Titolo,
          stato: r.Stato,
        })),
        offerteEliminate: offertaIds.length,
        candidatureEliminate: candIds.length,
      },
      null,
      2
    )
  );
  await pool.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
