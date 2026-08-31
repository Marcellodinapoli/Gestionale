import { sql, getPool } from "../db/pool.js";
import type { ConnectorConfig } from "../config.js";

export type MessaggioAgendaFilter = {
  praticaId?: string;
  letto?: boolean;
  praticaIdsIn?: string[];
};

function mapRow(r: Record<string, unknown>) {
  const row: Record<string, unknown> = {
    id: String(r.Id),
    praticaId: String(r.PraticaId),
    userId: String(r.UserId),
    memoAt: new Date(String(r.MemoAt)).toISOString(),
    line: String(r.Line),
    letto: Boolean(r.Letto),
    lettoAt: r.LettoAt ? new Date(String(r.LettoAt)).toISOString() : null,
    createdAt: new Date(String(r.CreatedAt)).toISOString(),
  };
  if (r.Numero != null) {
    row.pratica = {
      id: String(r.PraticaId),
      numero: String(r.Numero),
      debitore: {
        nome: String(r.DebitoreNome ?? ""),
        cognome: String(r.DebitoreCognome ?? ""),
      },
    };
  }
  if (r.UserName != null) {
    row.user = { id: String(r.UserId), name: String(r.UserName) };
  }
  return row;
}

export async function listMessaggiAgenda(
  cfg: ConnectorConfig["db"],
  tenantId: string,
  filter?: MessaggioAgendaFilter,
  take = 100
) {
  const pool = await getPool(cfg);
  const req = pool.request();
  req.input("tenantId", sql.UniqueIdentifier, tenantId);
  req.input("take", sql.Int, take);
  const clauses = ["m.TenantId = @tenantId"];
  if (filter?.praticaId) {
    req.input("praticaId", sql.UniqueIdentifier, filter.praticaId);
    clauses.push("m.PraticaId = @praticaId");
  }
  if (filter?.praticaIdsIn?.length) {
    filter.praticaIdsIn.forEach((id, i) => req.input(`pid${i}`, sql.UniqueIdentifier, id));
    clauses.push(`m.PraticaId IN (${filter.praticaIdsIn.map((_, i) => `@pid${i}`).join(", ")})`);
  }
  if (filter?.letto === false) clauses.push("m.Letto = 0");
  if (filter?.letto === true) clauses.push("m.Letto = 1");

  const res = await req.query(`
    SELECT TOP (@take) m.*, p.Numero, d.Nome AS DebitoreNome, d.Cognome AS DebitoreCognome, u.Name AS UserName
    FROM dbo.MessaggiAgenda m
    INNER JOIN dbo.Pratiche p ON p.Id = m.PraticaId
    INNER JOIN dbo.Debitori d ON d.Id = p.DebitoreId
    INNER JOIN dbo.Users u ON u.Id = m.UserId
    WHERE ${clauses.join(" AND ")}
    ORDER BY m.CreatedAt DESC
  `);
  return res.recordset.map((r) => mapRow(r as Record<string, unknown>));
}

export async function findOpenMessaggioAgenda(
  cfg: ConnectorConfig["db"],
  tenantId: string,
  praticaId: string
) {
  const rows = await listMessaggiAgenda(cfg, tenantId, { praticaId, letto: false }, 1);
  return rows[0] ?? null;
}

export async function upsertOpenMessaggioAgenda(
  cfg: ConnectorConfig["db"],
  tenantId: string,
  data: { praticaId: string; userId: string; memoAt: string | Date; line: string }
) {
  const open = await findOpenMessaggioAgenda(cfg, tenantId, data.praticaId);
  const pool = await getPool(cfg);
  if (open) {
    await pool
      .request()
      .input("id", sql.UniqueIdentifier, open.id)
      .input("userId", sql.UniqueIdentifier, data.userId)
      .input("memoAt", sql.DateTime2, new Date(data.memoAt))
      .input("line", sql.NVarChar(500), data.line)
      .query(`
        UPDATE dbo.MessaggiAgenda
        SET UserId = @userId, MemoAt = @memoAt, Line = @line
        WHERE Id = @id
      `);
    return;
  }
  await pool
    .request()
    .input("tenantId", sql.UniqueIdentifier, tenantId)
    .input("praticaId", sql.UniqueIdentifier, data.praticaId)
    .input("userId", sql.UniqueIdentifier, data.userId)
    .input("memoAt", sql.DateTime2, new Date(data.memoAt))
    .input("line", sql.NVarChar(500), data.line)
    .query(`
      INSERT INTO dbo.MessaggiAgenda (TenantId, PraticaId, UserId, MemoAt, Line, Letto, CreatedAt)
      VALUES (@tenantId, @praticaId, @userId, @memoAt, @line, 0, SYSUTCDATETIME())
    `);
}

export async function markMessaggioAgendaLetto(
  cfg: ConnectorConfig["db"],
  tenantId: string,
  id: string
) {
  const pool = await getPool(cfg);
  await pool
    .request()
    .input("tenantId", sql.UniqueIdentifier, tenantId)
    .input("id", sql.UniqueIdentifier, id)
    .query(`
      UPDATE dbo.MessaggiAgenda SET Letto = 1, LettoAt = SYSUTCDATETIME()
      WHERE Id = @id AND TenantId = @tenantId
    `);
}

export async function markMessaggiAgendaPraticaLetti(
  cfg: ConnectorConfig["db"],
  tenantId: string,
  praticaId: string
) {
  const pool = await getPool(cfg);
  await pool
    .request()
    .input("tenantId", sql.UniqueIdentifier, tenantId)
    .input("praticaId", sql.UniqueIdentifier, praticaId)
    .query(`
      UPDATE dbo.MessaggiAgenda SET Letto = 1, LettoAt = SYSUTCDATETIME()
      WHERE TenantId = @tenantId AND PraticaId = @praticaId AND Letto = 0
    `);
}

export async function getMessaggioAgendaById(
  cfg: ConnectorConfig["db"],
  tenantId: string,
  id: string
) {
  const pool = await getPool(cfg);
  const res = await pool
    .request()
    .input("tenantId", sql.UniqueIdentifier, tenantId)
    .input("id", sql.UniqueIdentifier, id)
    .query(`
      SELECT m.*, p.Numero, d.Nome AS DebitoreNome, d.Cognome AS DebitoreCognome, u.Name AS UserName
      FROM dbo.MessaggiAgenda m
      INNER JOIN dbo.Pratiche p ON p.Id = m.PraticaId
      INNER JOIN dbo.Debitori d ON d.Id = p.DebitoreId
      INNER JOIN dbo.Users u ON u.Id = m.UserId
      WHERE m.TenantId = @tenantId AND m.Id = @id
    `);
  const row = res.recordset[0];
  return row ? mapRow(row as Record<string, unknown>) : null;
}

export async function deleteMessaggiAgendaByPratica(
  cfg: ConnectorConfig["db"],
  tenantId: string,
  praticaId: string
) {
  const pool = await getPool(cfg);
  await pool
    .request()
    .input("tenantId", sql.UniqueIdentifier, tenantId)
    .input("praticaId", sql.UniqueIdentifier, praticaId)
    .query(`DELETE FROM dbo.MessaggiAgenda WHERE TenantId = @tenantId AND PraticaId = @praticaId`);
}
