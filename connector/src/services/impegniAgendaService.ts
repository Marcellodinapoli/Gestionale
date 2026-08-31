import { sql, getPool } from "../db/pool.js";
import type { ConnectorConfig } from "../config.js";

export type ImpegnoAgendaFilter = {
  userId?: string;
  completato?: boolean;
  memoAtGte?: string;
  memoAtLte?: string;
  id?: string;
};

function mapRow(r: Record<string, unknown>) {
  return {
    id: String(r.Id),
    userId: String(r.UserId),
    titolo: String(r.Titolo),
    nota: r.Nota != null ? String(r.Nota) : null,
    memoAt: new Date(String(r.MemoAt)).toISOString(),
    completato: Boolean(r.Completato),
    completatoAt: r.CompletatoAt ? new Date(String(r.CompletatoAt)).toISOString() : null,
    createdAt: new Date(String(r.CreatedAt)).toISOString(),
    userName: r.UserName != null ? String(r.UserName) : undefined,
  };
}

function bindFilter(req: sql.Request, tenantId: string, filter?: ImpegnoAgendaFilter) {
  req.input("tenantId", sql.UniqueIdentifier, tenantId);
  const clauses = ["i.TenantId = @tenantId"];
  if (filter?.userId) {
    req.input("userId", sql.UniqueIdentifier, filter.userId);
    clauses.push("i.UserId = @userId");
  }
  if (filter?.completato === false) clauses.push("i.Completato = 0");
  if (filter?.completato === true) clauses.push("i.Completato = 1");
  if (filter?.memoAtGte) {
    req.input("memoAtGte", sql.DateTime2, new Date(filter.memoAtGte));
    clauses.push("i.MemoAt >= @memoAtGte");
  }
  if (filter?.memoAtLte) {
    req.input("memoAtLte", sql.DateTime2, new Date(filter.memoAtLte));
    clauses.push("i.MemoAt <= @memoAtLte");
  }
  if (filter?.id) {
    req.input("id", sql.UniqueIdentifier, filter.id);
    clauses.push("i.Id = @id");
  }
  return clauses.join(" AND ");
}

export async function listImpegniAgenda(
  cfg: ConnectorConfig["db"],
  tenantId: string,
  filter?: ImpegnoAgendaFilter,
  take = 200
) {
  const pool = await getPool(cfg);
  const req = pool.request();
  const where = bindFilter(req, tenantId, filter);
  req.input("take", sql.Int, take);
  const res = await req.query(`
    SELECT TOP (@take) i.*, u.Name AS UserName
    FROM dbo.ImpegniAgenda i
    LEFT JOIN dbo.Users u ON u.Id = i.UserId
    WHERE ${where}
    ORDER BY i.MemoAt ASC
  `);
  return res.recordset.map((r) => mapRow(r as Record<string, unknown>));
}

export async function getImpegnoAgendaById(
  cfg: ConnectorConfig["db"],
  tenantId: string,
  id: string
) {
  const rows = await listImpegniAgenda(cfg, tenantId, { id }, 1);
  return rows[0] ?? null;
}

export async function createImpegnoAgenda(
  cfg: ConnectorConfig["db"],
  tenantId: string,
  data: { userId: string; titolo: string; nota?: string | null; memoAt: string | Date }
) {
  const pool = await getPool(cfg);
  const res = await pool
    .request()
    .input("tenantId", sql.UniqueIdentifier, tenantId)
    .input("userId", sql.UniqueIdentifier, data.userId)
    .input("titolo", sql.NVarChar(200), data.titolo)
    .input("nota", sql.NVarChar(sql.MAX), data.nota ?? null)
    .input("memoAt", sql.DateTime2, new Date(data.memoAt))
    .query(`
      INSERT INTO dbo.ImpegniAgenda (TenantId, UserId, Titolo, Nota, MemoAt, Completato, CreatedAt)
      OUTPUT INSERTED.*
      VALUES (@tenantId, @userId, @titolo, @nota, @memoAt, 0, SYSUTCDATETIME())
    `);
  return mapRow(res.recordset[0] as Record<string, unknown>);
}

export async function completeImpegnoAgenda(
  cfg: ConnectorConfig["db"],
  tenantId: string,
  id: string,
  userId: string
) {
  const pool = await getPool(cfg);
  await pool
    .request()
    .input("tenantId", sql.UniqueIdentifier, tenantId)
    .input("id", sql.UniqueIdentifier, id)
    .input("userId", sql.UniqueIdentifier, userId)
    .query(`
      UPDATE dbo.ImpegniAgenda
      SET Completato = 1, CompletatoAt = SYSUTCDATETIME()
      WHERE Id = @id AND TenantId = @tenantId AND UserId = @userId AND Completato = 0
    `);
}

export async function updateImpegnoAgenda(
  cfg: ConnectorConfig["db"],
  tenantId: string,
  id: string,
  userId: string,
  data: { titolo?: string; nota?: string | null; memoAt?: string | Date }
) {
  const pool = await getPool(cfg);
  const sets: string[] = [];
  const req = pool.request()
    .input("tenantId", sql.UniqueIdentifier, tenantId)
    .input("id", sql.UniqueIdentifier, id)
    .input("userId", sql.UniqueIdentifier, userId);
  if (data.titolo != null) {
    req.input("titolo", sql.NVarChar(200), data.titolo);
    sets.push("Titolo = @titolo");
  }
  if (data.nota !== undefined) {
    req.input("nota", sql.NVarChar(sql.MAX), data.nota);
    sets.push("Nota = @nota");
  }
  if (data.memoAt != null) {
    req.input("memoAt", sql.DateTime2, new Date(data.memoAt));
    sets.push("MemoAt = @memoAt");
  }
  if (!sets.length) return getImpegnoAgendaById(cfg, tenantId, id);
  await req.query(`
    UPDATE dbo.ImpegniAgenda SET ${sets.join(", ")}
    WHERE Id = @id AND TenantId = @tenantId AND UserId = @userId
  `);
  return getImpegnoAgendaById(cfg, tenantId, id);
}

export async function deleteImpegnoAgenda(
  cfg: ConnectorConfig["db"],
  tenantId: string,
  id: string,
  userId: string
) {
  const pool = await getPool(cfg);
  await pool
    .request()
    .input("tenantId", sql.UniqueIdentifier, tenantId)
    .input("id", sql.UniqueIdentifier, id)
    .input("userId", sql.UniqueIdentifier, userId)
    .query(`DELETE FROM dbo.ImpegniAgenda WHERE Id = @id AND TenantId = @tenantId AND UserId = @userId`);
}
