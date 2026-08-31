import { sql, getPool } from "../db/pool.js";
import type { ConnectorConfig } from "../config.js";

export type ConfigurazioneFilter = {
  tenantId?: string;
  chiave?: string;
  chiaviIn?: string[];
  chiaveStartsWith?: string;
  categoria?: string;
  chiaviOrStartsWith?: Array<{ startsWith?: string; in?: string[] }>;
};

function mapRow(r: Record<string, unknown>) {
  return {
    id: String(r.Id),
    tenantId: String(r.TenantId),
    chiave: String(r.Chiave),
    valore: String(r.Valore),
    categoria: String(r.Categoria),
    updatedAt: new Date(String(r.UpdatedAt)).toISOString(),
  };
}

function bindFilter(req: sql.Request, tenantId: string, filter?: ConfigurazioneFilter) {
  req.input("tenantId", sql.UniqueIdentifier, tenantId);
  const clauses = ["TenantId = @tenantId"];
  if (filter?.chiave) {
    req.input("chiave", sql.NVarChar(100), filter.chiave);
    clauses.push("Chiave = @chiave");
  }
  if (filter?.chiaviIn?.length) {
    filter.chiaviIn.forEach((k, i) => req.input(`ck${i}`, sql.NVarChar(100), k));
    clauses.push(`Chiave IN (${filter.chiaviIn.map((_, i) => `@ck${i}`).join(", ")})`);
  }
  if (filter?.categoria) {
    req.input("categoria", sql.NVarChar(50), filter.categoria);
    clauses.push("Categoria = @categoria");
  }
  if (filter?.chiaveStartsWith) {
    req.input("chiaveStartsWith", sql.NVarChar(100), filter.chiaveStartsWith);
    clauses.push("Chiave LIKE @chiaveStartsWith + '%'");
  }
  if (filter?.chiaviOrStartsWith?.length) {
    const orClauses: string[] = [];
    filter.chiaviOrStartsWith.forEach((clause, i) => {
      if (clause.startsWith) {
        req.input(`orSw${i}`, sql.NVarChar(100), clause.startsWith);
        orClauses.push(`Chiave LIKE @orSw${i} + '%'`);
      }
      if (clause.in?.length) {
        clause.in.forEach((k, j) => req.input(`orIn${i}_${j}`, sql.NVarChar(100), k));
        orClauses.push(`Chiave IN (${clause.in.map((_, j) => `@orIn${i}_${j}`).join(", ")})`);
      }
    });
    if (orClauses.length) clauses.push(`(${orClauses.join(" OR ")})`);
  }
  return clauses.join(" AND ");
}

export async function listConfigurazione(
  cfg: ConnectorConfig["db"],
  tenantId: string,
  filter?: ConfigurazioneFilter
) {
  const pool = await getPool(cfg);
  const req = pool.request();
  const where = bindFilter(req, tenantId, filter);
  const res = await req.query(`SELECT * FROM dbo.ConfigurazioneSistema WHERE ${where} ORDER BY Chiave ASC`);
  return res.recordset.map((r) => mapRow(r as Record<string, unknown>));
}

export async function getConfigurazioneByChiave(
  cfg: ConnectorConfig["db"],
  tenantId: string,
  chiave: string
) {
  const pool = await getPool(cfg);
  const res = await pool
    .request()
    .input("tenantId", sql.UniqueIdentifier, tenantId)
    .input("chiave", sql.NVarChar(100), chiave)
    .query(`SELECT * FROM dbo.ConfigurazioneSistema WHERE TenantId = @tenantId AND Chiave = @chiave`);
  return res.recordset[0] ? mapRow(res.recordset[0] as Record<string, unknown>) : null;
}

export async function upsertConfigurazione(
  cfg: ConnectorConfig["db"],
  tenantId: string,
  data: { chiave: string; valore: string; categoria: string }
) {
  const pool = await getPool(cfg);
  const res = await pool
    .request()
    .input("tenantId", sql.UniqueIdentifier, tenantId)
    .input("chiave", sql.NVarChar(100), data.chiave)
    .input("valore", sql.NVarChar(sql.MAX), data.valore)
    .input("categoria", sql.NVarChar(50), data.categoria)
    .query(`
      MERGE dbo.ConfigurazioneSistema AS t
      USING (SELECT @tenantId AS TenantId, @chiave AS Chiave) AS s
      ON t.TenantId = s.TenantId AND t.Chiave = s.Chiave
      WHEN MATCHED THEN
        UPDATE SET Valore = @valore, Categoria = @categoria, UpdatedAt = SYSUTCDATETIME()
      WHEN NOT MATCHED THEN
        INSERT (TenantId, Chiave, Valore, Categoria, UpdatedAt)
        VALUES (@tenantId, @chiave, @valore, @categoria, SYSUTCDATETIME())
      OUTPUT INSERTED.*;
    `);
  return mapRow(res.recordset[0] as Record<string, unknown>);
}

export async function deleteManyConfigurazione(
  cfg: ConnectorConfig["db"],
  tenantId: string,
  filter: ConfigurazioneFilter
) {
  const pool = await getPool(cfg);
  const req = pool.request();
  const where = bindFilter(req, tenantId, filter);
  const res = await req.query(`DELETE FROM dbo.ConfigurazioneSistema WHERE ${where}`);
  return { count: Number(res.rowsAffected[0] ?? 0) };
}
