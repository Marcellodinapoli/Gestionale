import { sql, getPool } from "../db/pool.js";
import type { ConnectorConfig } from "../config.js";

export type PostazioneFilter = {
  id?: string;
  idsIn?: string[];
  nome?: string;
  active?: boolean;
  sedeId?: string;
  excludeId?: string;
};

function mapRow(r: Record<string, unknown>) {
  return {
    id: String(r.Id),
    tenantId: String(r.TenantId),
    sedeId: r.SedeId != null ? String(r.SedeId) : null,
    nome: String(r.Nome),
    interno: r.Interno != null ? String(r.Interno) : null,
    email: r.Email != null ? String(r.Email) : null,
    numeroFisso: r.NumeroFisso != null ? String(r.NumeroFisso) : null,
    note: r.Note != null ? String(r.Note) : null,
    active: Boolean(r.Active),
    createdAt: new Date(String(r.CreatedAt)).toISOString(),
  };
}

function bindFilter(req: sql.Request, tenantId: string, filter?: PostazioneFilter, alias = "") {
  req.input("tenantId", sql.UniqueIdentifier, tenantId);
  const p = (col: string) => (alias ? `${alias}.${col}` : col);
  const clauses = [`${p("TenantId")} = @tenantId`];
  if (filter?.id) {
    req.input("id", sql.UniqueIdentifier, filter.id);
    clauses.push(`${p("Id")} = @id`);
  }
  if (filter?.idsIn?.length) {
    filter.idsIn.forEach((id, i) => req.input(`pid${i}`, sql.UniqueIdentifier, id));
    clauses.push(`${p("Id")} IN (${filter.idsIn.map((_, i) => `@pid${i}`).join(", ")})`);
  }
  if (filter?.nome) {
    req.input("nome", sql.NVarChar(120), filter.nome);
    clauses.push(`${p("Nome")} = @nome`);
  }
  if (filter?.active !== undefined) {
    req.input("active", sql.Bit, filter.active ? 1 : 0);
    clauses.push(`${p("Active")} = @active`);
  }
  if (filter?.sedeId) {
    req.input("sedeId", sql.UniqueIdentifier, filter.sedeId);
    clauses.push(`${p("SedeId")} = @sedeId`);
  }
  if (filter?.excludeId) {
    req.input("excludeId", sql.UniqueIdentifier, filter.excludeId);
    clauses.push(`${p("Id")} <> @excludeId`);
  }
  return clauses.join(" AND ");
}

function orderClause(orderBy?: string, orderDir?: string, alias = "p") {
  const dir = orderDir === "desc" ? "DESC" : "ASC";
  if (orderBy === "createdAt") return `${alias}.CreatedAt ${dir}`;
  if (orderBy === "sedeNome") return `s.Nome ${dir}, ${alias}.Nome ASC`;
  return `${alias}.Nome ${dir}`;
}

async function attachOccupants(
  cfg: ConnectorConfig["db"],
  tenantId: string,
  items: ReturnType<typeof mapRow>[],
  excludeUserId?: string
) {
  if (!items.length) return items;
  const pool = await getPool(cfg);
  const req = pool.request();
  req.input("tenantId", sql.UniqueIdentifier, tenantId);
  items.forEach((item, i) => req.input(`pid${i}`, sql.UniqueIdentifier, item.id));
  if (excludeUserId) req.input("excludeUserId", sql.UniqueIdentifier, excludeUserId);
  const excludeClause = excludeUserId ? " AND u.Id <> @excludeUserId" : "";
  const res = await req.query(`
    SELECT u.Id, u.Name, u.PostazioneId
    FROM dbo.Users u
    WHERE u.TenantId = @tenantId
      AND u.Active = 1
      AND u.PostazioneId IN (${items.map((_, i) => `@pid${i}`).join(", ")})
      ${excludeClause}
  `);
  const byPostazione = new Map<string, Array<{ id: string; name: string }>>();
  for (const row of res.recordset as Array<Record<string, unknown>>) {
    const postazioneId = String(row.PostazioneId);
    const list = byPostazione.get(postazioneId) ?? [];
    list.push({ id: String(row.Id), name: String(row.Name) });
    byPostazione.set(postazioneId, list);
  }
  return items.map((item) => ({
    ...item,
    occupanti: byPostazione.get(item.id) ?? [],
  }));
}

export async function listPostazioni(
  cfg: ConnectorConfig["db"],
  tenantId: string,
  opts?: {
    filter?: PostazioneFilter;
    orderBy?: string;
    orderDir?: string;
    take?: number;
    includeSede?: boolean;
    includeOccupants?: boolean;
    excludeOccupantUserId?: string;
  }
) {
  const pool = await getPool(cfg);
  const req = pool.request();
  const where = bindFilter(req, tenantId, opts?.filter, "p");
  const take = Math.min(opts?.take ?? 500, 500);
  req.input("take", sql.Int, take);
  const joinSede = opts?.includeSede || opts?.orderBy === "sedeNome";
  const sedeCols = opts?.includeSede ? ", s.Nome AS SedeNome" : "";
  const res = await req.query(`
    SELECT TOP (@take) p.*${sedeCols}
    FROM dbo.Postazioni p
    ${joinSede ? "LEFT JOIN dbo.Sedi s ON s.Id = p.SedeId AND s.TenantId = p.TenantId" : ""}
    WHERE ${where}
    ORDER BY ${orderClause(opts?.orderBy, opts?.orderDir, "p")}
  `);
  let items = res.recordset.map((r) => {
    const rec = r as Record<string, unknown>;
    const row = mapRow(rec);
    if (opts?.includeSede) {
      (row as Record<string, unknown>).sedeRef = rec.SedeId
        ? { id: String(rec.SedeId), nome: rec.SedeNome != null ? String(rec.SedeNome) : "" }
        : null;
    }
    return row;
  });
  if (opts?.includeOccupants) {
    items = await attachOccupants(cfg, tenantId, items, opts.excludeOccupantUserId);
  }
  return items;
}

export async function countPostazioni(
  cfg: ConnectorConfig["db"],
  tenantId: string,
  filter?: PostazioneFilter
) {
  const pool = await getPool(cfg);
  const req = pool.request();
  const where = bindFilter(req, tenantId, filter);
  const res = await req.query(`SELECT COUNT(*) AS total FROM dbo.Postazioni WHERE ${where}`);
  return Number(res.recordset[0]?.total ?? 0);
}

export async function getPostazioneById(cfg: ConnectorConfig["db"], tenantId: string, id: string) {
  const pool = await getPool(cfg);
  const res = await pool
    .request()
    .input("tenantId", sql.UniqueIdentifier, tenantId)
    .input("id", sql.UniqueIdentifier, id)
    .query(`SELECT * FROM dbo.Postazioni WHERE TenantId = @tenantId AND Id = @id`);
  return res.recordset[0] ? mapRow(res.recordset[0] as Record<string, unknown>) : null;
}

export async function createPostazione(
  cfg: ConnectorConfig["db"],
  tenantId: string,
  data: {
    nome: string;
    sedeId?: string | null;
    interno?: string | null;
    email?: string | null;
    numeroFisso?: string | null;
    note?: string | null;
    active?: boolean;
  }
) {
  const pool = await getPool(cfg);
  const res = await pool
    .request()
    .input("tenantId", sql.UniqueIdentifier, tenantId)
    .input("nome", sql.NVarChar(120), data.nome)
    .input("sedeId", sql.UniqueIdentifier, data.sedeId ?? null)
    .input("interno", sql.NVarChar(30), data.interno ?? null)
    .input("email", sql.NVarChar(200), data.email ?? null)
    .input("numeroFisso", sql.NVarChar(30), data.numeroFisso ?? null)
    .input("note", sql.NVarChar(sql.MAX), data.note ?? null)
    .input("active", sql.Bit, data.active !== false ? 1 : 0)
    .query(`
      INSERT INTO dbo.Postazioni (TenantId, SedeId, Nome, Interno, Email, NumeroFisso, Note, Active, CreatedAt)
      OUTPUT INSERTED.*
      VALUES (@tenantId, @sedeId, @nome, @interno, @email, @numeroFisso, @note, @active, SYSUTCDATETIME())
    `);
  return mapRow(res.recordset[0] as Record<string, unknown>);
}

export async function updatePostazione(
  cfg: ConnectorConfig["db"],
  tenantId: string,
  id: string,
  data: Record<string, unknown>
) {
  const pool = await getPool(cfg);
  const fieldMap: Record<string, string> = {
    nome: "Nome",
    sedeId: "SedeId",
    interno: "Interno",
    email: "Email",
    numeroFisso: "NumeroFisso",
    note: "Note",
    active: "Active",
  };
  const req = pool.request();
  req.input("tenantId", sql.UniqueIdentifier, tenantId);
  req.input("id", sql.UniqueIdentifier, id);
  const sets: string[] = [];
  let i = 0;
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined) continue;
    const col = fieldMap[k];
    if (!col) continue;
    const p = `p${i++}`;
    if (k === "active") {
      req.input(p, sql.Bit, v ? 1 : 0);
    } else if (k === "sedeId" && v === null) {
      sets.push(`${col} = NULL`);
      continue;
    } else if (v === null) {
      sets.push(`${col} = NULL`);
      continue;
    } else if (k === "sedeId") {
      req.input(p, sql.UniqueIdentifier, String(v));
    } else {
      req.input(p, sql.NVarChar(500), String(v));
    }
    sets.push(`${col} = @${p}`);
  }
  if (!sets.length) return getPostazioneById(cfg, tenantId, id);
  const res = await req.query(`
    UPDATE dbo.Postazioni SET ${sets.join(", ")} OUTPUT INSERTED.*
    WHERE TenantId = @tenantId AND Id = @id
  `);
  return res.recordset[0] ? mapRow(res.recordset[0] as Record<string, unknown>) : null;
}

export async function deletePostazione(cfg: ConnectorConfig["db"], tenantId: string, id: string) {
  const pool = await getPool(cfg);
  await pool
    .request()
    .input("tenantId", sql.UniqueIdentifier, tenantId)
    .input("id", sql.UniqueIdentifier, id)
    .query(`DELETE FROM dbo.Postazioni WHERE TenantId = @tenantId AND Id = @id`);
}
