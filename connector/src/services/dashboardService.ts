import { sql, getPool } from "../db/pool.js";
import type { ConnectorConfig } from "../config.js";

export async function getDashboardHome(cfg: ConnectorConfig["db"], tenantId: string) {
  const pool = await getPool(cfg);
  const start = performance.now();

  const result = await pool.request().input("tenantId", sql.UniqueIdentifier, tenantId).query(`
    SELECT
      (SELECT COUNT(*) FROM dbo.Pratiche WHERE TenantId = @tenantId) AS praticheTotali,
      (SELECT COUNT(*) FROM dbo.Pratiche WHERE TenantId = @tenantId AND Stato = N'NUOVA') AS praticheNuove,
      (SELECT COUNT(*) FROM dbo.Pratiche WHERE TenantId = @tenantId AND Stato = N'IN_LAVORAZIONE') AS praticheInLavoro,
      (SELECT COUNT(*) FROM dbo.Pratiche WHERE TenantId = @tenantId AND Scadenza < SYSUTCDATETIME() AND Stato NOT IN (N'INCASSO', N'RESA', N'INESIGIBILE')) AS praticheScadute,
      (SELECT ISNULL(SUM(Importo), 0) FROM dbo.Incassi WHERE TenantId = @tenantId AND Data >= CAST(SYSUTCDATETIME() AS DATE)) AS incassiOggi,
      (SELECT COUNT(*) FROM dbo.Users WHERE TenantId = @tenantId AND Active = 1) AS operatoriAttivi,
      (SELECT COUNT(*) FROM dbo.Mandanti WHERE TenantId = @tenantId) AS mandanti
  `);

  const kpi = await pool.request().input("tenantId", sql.UniqueIdentifier, tenantId).query(`
    SELECT ScopeType, ScopeId, KpiKey, ValoreNumeric, ValoreJson, UpdatedAt
    FROM dbo.DashboardKpi
    WHERE TenantId = @tenantId
  `);

  return {
    summary: result.recordset[0],
    kpi: kpi.recordset,
    queryMs: Math.round(performance.now() - start),
  };
}
