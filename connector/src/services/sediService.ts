import { sql, getPool } from "../db/pool.js";
import type { ConnectorConfig } from "../config.js";

export type SedeFilter = {
  id?: string;
  idsIn?: string[];
  nome?: string;
  active?: boolean;
  excludeId?: string;
};

function mapRow(r: Record<string, unknown>) {
  return {
    id: String(r.Id),
    tenantId: String(r.TenantId),
    nome: String(r.Nome),
    indirizzo: r.Indirizzo != null ? String(r.Indirizzo) : null,
    citta: r.Citta != null ? String(r.Citta) : null,
    cap: r.Cap != null ? String(r.Cap) : null,
    provincia: r.Provincia != null ? String(r.Provincia) : null,
    telefono: r.Telefono != null ? String(r.Telefono) : null,
    email: r.Email != null ? String(r.Email) : null,
    note: r.Note != null ? String(r.Note) : null,
    active: Boolean(r.Active),
    createdAt: new Date(String(r.CreatedAt)).toISOString(),
  };
}

function bindFilter(req: sql.Request, tenantId: string, filter?: SedeFilter, alias = "") {
  req.input("tenantId", sql.UniqueIdentifier, tenantId);
  const p = (col: string) => (alias ? `${alias}.${col}` : col);
  const clauses = [`${p("TenantId")} = @tenantId`];
  if (filter?.id) {
    req.input("id", sql.UniqueIdentifier, filter.id);
    clauses.push(`${p("Id")} = @id`);
  }
  if (filter?.idsIn?.length) {
    filter.idsIn.forEach((id, i) => req.input(`sid${i}`, sql.UniqueIdentifier, id));
    clauses.push(`${p("Id")} IN (${filter.idsIn.map((_, i) => `@sid${i}`).join(", ")})`);
  }
  if (filter?.nome) {
    req.input("nome", sql.NVarChar(120), filter.nome);
    clauses.push(`${p("Nome")} = @nome`);
  }
  if (filter?.active !== undefined) {
    req.input("active", sql.Bit, filter.active ? 1 : 0);
    clauses.push(`${p("Active")} = @active`);
  }
  if (filter?.excludeId) {
    req.input("excludeId", sql.UniqueIdentifier, filter.excludeId);
    clauses.push(`${p("Id")} <> @excludeId`);
  }
  return clauses.join(" AND ");
}

export async function listSedi(
  cfg: ConnectorConfig["db"],
  tenantId: string,
  opts?: {
    filter?: SedeFilter;
    orderBy?: string;
    orderDir?: string;
    take?: number;
    includeCounts?: boolean;
  }
) {
  const pool = await getPool(cfg);
  const req = pool.request();
  const where = bindFilter(req, tenantId, opts?.filter, "s");
  const orderCol = opts?.orderBy === "createdAt" ? "CreatedAt" : "Nome";
  const orderDir = opts?.orderDir === "desc" ? "DESC" : "ASC";
  const take = Math.min(opts?.take ?? 500, 500);
  req.input("take", sql.Int, take);
  const countCols = opts?.includeCounts
    ? `, (SELECT COUNT(*) FROM dbo.Postazioni p WHERE p.SedeId = s.Id AND p.TenantId = s.TenantId) AS PostazioneCount
       , (SELECT COUNT(*) FROM dbo.Users u WHERE u.SedeId = s.Id AND u.TenantId = s.TenantId) AS UserCount`
    : "";
  const res = await req.query(`
    SELECT TOP (@take) s.*${countCols}
    FROM dbo.Sedi s WHERE ${where}
    ORDER BY s.${orderCol} ${orderDir}
  `);
  return res.recordset.map((r) => {
    const row = mapRow(r as Record<string, unknown>);
    if (opts?.includeCounts) {
      const rec = r as Record<string, unknown>;
      (row as Record<string, unknown>)._count = {
        postazioni: Number(rec.PostazioneCount ?? 0),
        users: Number(rec.UserCount ?? 0),
      };
    }
    return row;
  });
}

export async function countSedi(
  cfg: ConnectorConfig["db"],
  tenantId: string,
  filter?: SedeFilter
) {
  const pool = await getPool(cfg);
  const req = pool.request();
  const where = bindFilter(req, tenantId, filter);
  const res = await req.query(`SELECT COUNT(*) AS total FROM dbo.Sedi WHERE ${where}`);
  return Number(res.recordset[0]?.total ?? 0);
}

export async function getSedeById(cfg: ConnectorConfig["db"], tenantId: string, id: string) {
  const pool = await getPool(cfg);
  const res = await pool
    .request()
    .input("tenantId", sql.UniqueIdentifier, tenantId)
    .input("id", sql.UniqueIdentifier, id)
    .query(`SELECT * FROM dbo.Sedi WHERE TenantId = @tenantId AND Id = @id`);
  return res.recordset[0] ? mapRow(res.recordset[0] as Record<string, unknown>) : null;
}

export async function createSede(
  cfg: ConnectorConfig["db"],
  tenantId: string,
  data: {
    nome: string;
    indirizzo?: string | null;
    citta?: string | null;
    cap?: string | null;
    provincia?: string | null;
    telefono?: string | null;
    email?: string | null;
    note?: string | null;
    active?: boolean;
  }
) {
  const pool = await getPool(cfg);
  const res = await pool
    .request()
    .input("tenantId", sql.UniqueIdentifier, tenantId)
    .input("nome", sql.NVarChar(120), data.nome)
    .input("indirizzo", sql.NVarChar(300), data.indirizzo ?? null)
    .input("citta", sql.NVarChar(100), data.citta ?? null)
    .input("cap", sql.NVarChar(10), data.cap ?? null)
    .input("provincia", sql.NVarChar(5), data.provincia ?? null)
    .input("telefono", sql.NVarChar(30), data.telefono ?? null)
    .input("email", sql.NVarChar(200), data.email ?? null)
    .input("note", sql.NVarChar(sql.MAX), data.note ?? null)
    .input("active", sql.Bit, data.active !== false ? 1 : 0)
    .query(`
      INSERT INTO dbo.Sedi (TenantId, Nome, Indirizzo, Citta, Cap, Provincia, Telefono, Email, Note, Active, CreatedAt)
      OUTPUT INSERTED.*
      VALUES (@tenantId, @nome, @indirizzo, @citta, @cap, @provincia, @telefono, @email, @note, @active, SYSUTCDATETIME())
    `);
  return mapRow(res.recordset[0] as Record<string, unknown>);
}

export async function updateSede(
  cfg: ConnectorConfig["db"],
  tenantId: string,
  id: string,
  data: Record<string, unknown>
) {
  const pool = await getPool(cfg);
  const fieldMap: Record<string, string> = {
    nome: "Nome",
    indirizzo: "Indirizzo",
    citta: "Citta",
    cap: "Cap",
    provincia: "Provincia",
    telefono: "Telefono",
    email: "Email",
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
    } else if (v === null) {
      sets.push(`${col} = NULL`);
      continue;
    } else {
      req.input(p, sql.NVarChar(500), String(v));
    }
    sets.push(`${col} = @${p}`);
  }
  if (!sets.length) return getSedeById(cfg, tenantId, id);
  const res = await req.query(`
    UPDATE dbo.Sedi SET ${sets.join(", ")} OUTPUT INSERTED.*
    WHERE TenantId = @tenantId AND Id = @id
  `);
  return res.recordset[0] ? mapRow(res.recordset[0] as Record<string, unknown>) : null;
}
