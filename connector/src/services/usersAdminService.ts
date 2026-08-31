import { sql, getPool } from "../db/pool.js";
import type { ConnectorConfig } from "../config.js";

export type UserFilter = {
  tenantId?: string;
  id?: string;
  idsIn?: string[];
  email?: string;
  active?: boolean;
  role?: string;
  rolesIn?: string[];
  supervisorId?: string | null;
  supervisorIdSet?: boolean;
  formazioneOnly?: boolean;
  sedeId?: string | null;
  sedeIdSet?: boolean;
  postazioneId?: string | null;
  postazioneIdSet?: boolean;
  excludeId?: string;
  excludeRole?: string;
};

export type UserInclude = {
  sede?: boolean;
  postazione?: boolean;
  supervisor?: boolean;
};

const USER_COLS = `
  u.Id, u.TenantId, u.Email, u.Name, u.Cognome, u.CodiceFiscale, u.AnnoNascita, u.Residenza,
  u.PasswordHash, u.PasswordChangedAt,
  u.Role, u.Acronimo, u.FormazioneOnly, u.Interno, u.PrefissoChiamata,
  u.Active, u.SupervisorId, u.GruppoNome, u.GruppoMandantiJson,
  u.PostazioneId, u.PostazioneFissa, u.SedeId, u.CondizioneEconomica, u.ImportoFisso,
  u.LastLoginAt, u.LastLogoutAt, u.CreatedAt
`;

function mapRow(r: Record<string, unknown>, include?: UserInclude) {
  const row: Record<string, unknown> = {
    id: String(r.Id),
    tenantId: String(r.TenantId),
    email: String(r.Email),
    name: String(r.Name),
    cognome: r.Cognome != null ? String(r.Cognome) : null,
    codiceFiscale: r.CodiceFiscale != null ? String(r.CodiceFiscale) : null,
    annoNascita: r.AnnoNascita != null ? Number(r.AnnoNascita) : null,
    residenza: r.Residenza != null ? String(r.Residenza) : null,
    passwordHash: r.PasswordHash != null ? String(r.PasswordHash) : undefined,
    passwordChangedAt: r.PasswordChangedAt ? new Date(String(r.PasswordChangedAt)).toISOString() : null,
    role: String(r.Role),
    acronimo: r.Acronimo != null ? String(r.Acronimo) : null,
    formazioneOnly: Boolean(r.FormazioneOnly),
    interno: r.Interno != null ? String(r.Interno) : null,
    prefissoChiamata: r.PrefissoChiamata != null ? String(r.PrefissoChiamata) : null,
    active: Boolean(r.Active),
    supervisorId: r.SupervisorId != null ? String(r.SupervisorId) : null,
    gruppoNome: r.GruppoNome != null ? String(r.GruppoNome) : null,
    gruppoMandanti: r.GruppoMandantiJson != null ? String(r.GruppoMandantiJson) : null,
    postazioneId: r.PostazioneId != null ? String(r.PostazioneId) : null,
    postazioneFissa: Boolean(r.PostazioneFissa),
    sedeId: r.SedeId != null ? String(r.SedeId) : null,
    condizioneEconomica:
      r.CondizioneEconomica != null ? String(r.CondizioneEconomica) : "SOLO_PROVV",
    importoFisso: r.ImportoFisso != null ? Number(r.ImportoFisso) : null,
    lastLoginAt: r.LastLoginAt ? new Date(String(r.LastLoginAt)).toISOString() : null,
    lastLogoutAt: r.LastLogoutAt ? new Date(String(r.LastLogoutAt)).toISOString() : null,
    createdAt: r.CreatedAt ? new Date(String(r.CreatedAt)).toISOString() : null,
  };
  if (include?.sede && r.SedeNome != null) {
    row.sede = { nome: String(r.SedeNome) };
  }
  if (include?.supervisor && r.SupervisorName != null) {
    row.supervisor = { name: String(r.SupervisorName) };
  }
  if (include?.postazione && (r.PostazioneNome != null || r.PostazioneInterno != null)) {
    row.postazione = {
      nome: r.PostazioneNome != null ? String(r.PostazioneNome) : null,
      interno: r.PostazioneInterno != null ? String(r.PostazioneInterno) : null,
      email: r.PostazioneEmail != null ? String(r.PostazioneEmail) : null,
      numeroFisso: r.PostazioneNumeroFisso != null ? String(r.PostazioneNumeroFisso) : null,
      sedeRef: r.PostazioneSedeNome ? { nome: String(r.PostazioneSedeNome) } : null,
    };
  }
  return row;
}

function bindFilter(req: sql.Request, tenantId: string, filter?: UserFilter, alias = "u") {
  req.input("tenantId", sql.UniqueIdentifier, tenantId);
  const p = (col: string) => `${alias}.${col}`;
  const clauses = [`${p("TenantId")} = @tenantId`];
  if (filter?.id) {
    req.input("id", sql.UniqueIdentifier, filter.id);
    clauses.push(`${p("Id")} = @id`);
  }
  if (filter?.idsIn?.length) {
    filter.idsIn.forEach((id, i) => req.input(`uid${i}`, sql.UniqueIdentifier, id));
    clauses.push(`${p("Id")} IN (${filter.idsIn.map((_, i) => `@uid${i}`).join(", ")})`);
  }
  if (filter?.email) {
    req.input("email", sql.NVarChar(320), filter.email.toLowerCase());
    clauses.push(`${p("Email")} = @email`);
  }
  if (filter?.active !== undefined) {
    req.input("active", sql.Bit, filter.active ? 1 : 0);
    clauses.push(`${p("Active")} = @active`);
  }
  if (filter?.role) {
    req.input("role", sql.NVarChar(50), filter.role);
    clauses.push(`${p("Role")} = @role`);
  }
  if (filter?.rolesIn?.length) {
    filter.rolesIn.forEach((role, i) => req.input(`role${i}`, sql.NVarChar(50), role));
    clauses.push(`${p("Role")} IN (${filter.rolesIn.map((_, i) => `@role${i}`).join(", ")})`);
  }
  if (filter?.supervisorIdSet) {
    if (filter.supervisorId) {
      req.input("supervisorId", sql.UniqueIdentifier, filter.supervisorId);
      clauses.push(`${p("SupervisorId")} = @supervisorId`);
    } else {
      clauses.push(`${p("SupervisorId")} IS NULL`);
    }
  } else if (filter?.supervisorId) {
    req.input("supervisorId", sql.UniqueIdentifier, filter.supervisorId);
    clauses.push(`${p("SupervisorId")} = @supervisorId`);
  }
  if (filter?.formazioneOnly !== undefined) {
    req.input("formazioneOnly", sql.Bit, filter.formazioneOnly ? 1 : 0);
    clauses.push(`${p("FormazioneOnly")} = @formazioneOnly`);
  }
  if (filter?.sedeIdSet) {
    if (filter.sedeId) {
      req.input("sedeId", sql.UniqueIdentifier, filter.sedeId);
      clauses.push(`${p("SedeId")} = @sedeId`);
    } else {
      clauses.push(`${p("SedeId")} IS NULL`);
    }
  } else if (filter?.sedeId) {
    req.input("sedeId", sql.UniqueIdentifier, filter.sedeId);
    clauses.push(`${p("SedeId")} = @sedeId`);
  }
  if (filter?.postazioneIdSet) {
    if (filter.postazioneId) {
      req.input("postazioneId", sql.UniqueIdentifier, filter.postazioneId);
      clauses.push(`${p("PostazioneId")} = @postazioneId`);
    } else {
      clauses.push(`${p("PostazioneId")} IS NULL`);
    }
  } else if (filter?.postazioneId) {
    req.input("postazioneId", sql.UniqueIdentifier, filter.postazioneId);
    clauses.push(`${p("PostazioneId")} = @postazioneId`);
  }
  if (filter?.excludeId) {
    req.input("excludeId", sql.UniqueIdentifier, filter.excludeId);
    clauses.push(`${p("Id")} <> @excludeId`);
  }
  if (filter?.excludeRole) {
    req.input("excludeRole", sql.NVarChar(50), filter.excludeRole);
    clauses.push(`${p("Role")} <> @excludeRole`);
  }
  return clauses.join(" AND ");
}

function includeJoins(include?: UserInclude) {
  const joins: string[] = [];
  const cols: string[] = [];
  if (include?.sede) {
    joins.push("LEFT JOIN dbo.Sedi sed ON sed.Id = u.SedeId AND sed.TenantId = u.TenantId");
    cols.push("sed.Nome AS SedeNome");
  }
  if (include?.supervisor) {
    joins.push("LEFT JOIN dbo.Users sup ON sup.Id = u.SupervisorId AND sup.TenantId = u.TenantId");
    cols.push("sup.Name AS SupervisorName");
  }
  if (include?.postazione) {
    joins.push("LEFT JOIN dbo.Postazioni p ON p.Id = u.PostazioneId AND p.TenantId = u.TenantId");
    joins.push("LEFT JOIN dbo.Sedi ps ON ps.Id = p.SedeId AND ps.TenantId = u.TenantId");
    cols.push(
      "p.Nome AS PostazioneNome",
      "p.Interno AS PostazioneInterno",
      "p.Email AS PostazioneEmail",
      "p.NumeroFisso AS PostazioneNumeroFisso",
      "ps.Nome AS PostazioneSedeNome"
    );
  }
  return { joins: joins.join("\n"), extraCols: cols.length ? `, ${cols.join(", ")}` : "" };
}

export async function listUsers(
  cfg: ConnectorConfig["db"],
  tenantId: string,
  opts?: {
    filter?: UserFilter;
    orderBy?: string;
    orderDir?: string;
    skip?: number;
    take?: number;
    include?: UserInclude;
  }
) {
  const pool = await getPool(cfg);
  const req = pool.request();
  const where = bindFilter(req, tenantId, opts?.filter, "u");
  const orderColMap: Record<string, string> = {
    name: "Name",
    email: "Email",
    role: "Role",
    createdAt: "CreatedAt",
    lastLoginAt: "LastLoginAt",
  };
  const orderCol = orderColMap[opts?.orderBy ?? "name"] ?? "Name";
  const orderDir = opts?.orderDir === "desc" ? "DESC" : "ASC";
  const take = Math.min(opts?.take ?? 500, 500);
  const skip = Math.max(opts?.skip ?? 0, 0);
  req.input("take", sql.Int, take);
  req.input("skip", sql.Int, skip);
  const { joins, extraCols } = includeJoins(opts?.include);
  const res = await req.query(`
    SELECT ${USER_COLS}${extraCols}
    FROM dbo.Users u
    ${joins}
    WHERE ${where}
    ORDER BY u.${orderCol} ${orderDir}
    OFFSET @skip ROWS FETCH NEXT @take ROWS ONLY
  `);
  const countReq = pool.request();
  const countWhere = bindFilter(countReq, tenantId, opts?.filter, "u");
  const countRes = await countReq.query(`SELECT COUNT(*) AS total FROM dbo.Users u WHERE ${countWhere}`);
  return {
    items: res.recordset.map((r) => mapRow(r as Record<string, unknown>, opts?.include)),
    total: Number(countRes.recordset[0]?.total ?? 0),
  };
}

export async function countUsers(cfg: ConnectorConfig["db"], tenantId: string, filter?: UserFilter) {
  const pool = await getPool(cfg);
  const req = pool.request();
  const where = bindFilter(req, tenantId, filter, "u");
  const res = await req.query(`SELECT COUNT(*) AS total FROM dbo.Users u WHERE ${where}`);
  return Number(res.recordset[0]?.total ?? 0);
}

export async function getUserById(
  cfg: ConnectorConfig["db"],
  tenantId: string,
  id: string,
  include?: UserInclude
) {
  const pool = await getPool(cfg);
  const req = pool.request();
  const where = bindFilter(req, tenantId, { id }, "u");
  const { joins, extraCols } = includeJoins(include);
  const res = await req.query(`
    SELECT ${USER_COLS}${extraCols}
    FROM dbo.Users u
    ${joins}
    WHERE ${where}
  `);
  const row = res.recordset[0];
  return row ? mapRow(row as Record<string, unknown>, include) : null;
}

export async function getUserByEmail(
  cfg: ConnectorConfig["db"],
  tenantId: string,
  email: string,
  include?: UserInclude
) {
  const pool = await getPool(cfg);
  const req = pool.request();
  const where = bindFilter(req, tenantId, { email: email.toLowerCase() }, "u");
  const { joins, extraCols } = includeJoins(include);
  const res = await req.query(`
    SELECT ${USER_COLS}${extraCols}
    FROM dbo.Users u
    ${joins}
    WHERE ${where}
  `);
  const row = res.recordset[0];
  return row ? mapRow(row as Record<string, unknown>, include) : null;
}

export async function createUser(
  cfg: ConnectorConfig["db"],
  tenantId: string,
  data: Record<string, unknown>
) {
  const pool = await getPool(cfg);
  const res = await pool
    .request()
    .input("tenantId", sql.UniqueIdentifier, tenantId)
    .input("email", sql.NVarChar(320), String(data.email).toLowerCase())
    .input("name", sql.NVarChar(200), String(data.name))
    .input("cognome", sql.NVarChar(120), data.cognome ?? null)
    .input("codiceFiscale", sql.NVarChar(16), data.codiceFiscale ?? null)
    .input("annoNascita", sql.SmallInt, data.annoNascita ?? null)
    .input("residenza", sql.NVarChar(300), data.residenza ?? null)
    .input("passwordHash", sql.NVarChar(500), String(data.passwordHash))
    .input("passwordChangedAt", sql.DateTime2(3), data.passwordChangedAt ? new Date(String(data.passwordChangedAt)) : new Date())
    .input("role", sql.NVarChar(50), String(data.role))
    .input("acronimo", sql.NVarChar(20), data.acronimo ?? null)
    .input("formazioneOnly", sql.Bit, data.formazioneOnly ? 1 : 0)
    .input("interno", sql.NVarChar(30), data.interno ?? null)
    .input("prefissoChiamata", sql.NVarChar(20), data.prefissoChiamata ?? null)
    .input("active", sql.Bit, data.active !== false ? 1 : 0)
    .input("supervisorId", sql.UniqueIdentifier, data.supervisorId ?? null)
    .input("gruppoNome", sql.NVarChar(120), data.gruppoNome ?? null)
    .input("gruppoMandanti", sql.NVarChar(sql.MAX), data.gruppoMandanti ?? null)
    .input("postazioneId", sql.UniqueIdentifier, data.postazioneId ?? null)
    .input("postazioneFissa", sql.Bit, data.postazioneFissa ? 1 : 0)
    .input("sedeId", sql.UniqueIdentifier, data.sedeId ?? null)
    .input("condizioneEconomica", sql.NVarChar(20), data.condizioneEconomica ?? "SOLO_PROVV")
    .input("importoFisso", sql.Decimal(18, 2), data.importoFisso ?? null)
    .query(`
      INSERT INTO dbo.Users (
        TenantId, Email, Name, Cognome, CodiceFiscale, AnnoNascita, Residenza,
        PasswordHash, PasswordChangedAt, Role, Acronimo,
        FormazioneOnly, Interno, PrefissoChiamata, Active, SupervisorId, GruppoNome,
        GruppoMandantiJson, PostazioneId, PostazioneFissa, SedeId,
        CondizioneEconomica, ImportoFisso, CreatedAt
      )
      OUTPUT INSERTED.*
      VALUES (
        @tenantId, @email, @name, @cognome, @codiceFiscale, @annoNascita, @residenza,
        @passwordHash, @passwordChangedAt, @role, @acronimo,
        @formazioneOnly, @interno, @prefissoChiamata, @active, @supervisorId, @gruppoNome,
        @gruppoMandanti, @postazioneId, @postazioneFissa, @sedeId,
        @condizioneEconomica, @importoFisso, SYSUTCDATETIME()
      )
    `);
  return mapRow(res.recordset[0] as Record<string, unknown>);
}

export async function updateUser(
  cfg: ConnectorConfig["db"],
  tenantId: string,
  id: string,
  data: Record<string, unknown>
) {
  const pool = await getPool(cfg);
  const fieldMap: Record<string, string> = {
    name: "Name",
    cognome: "Cognome",
    email: "Email",
    codiceFiscale: "CodiceFiscale",
    annoNascita: "AnnoNascita",
    residenza: "Residenza",
    passwordHash: "PasswordHash",
    passwordChangedAt: "PasswordChangedAt",
    role: "Role",
    acronimo: "Acronimo",
    formazioneOnly: "FormazioneOnly",
    interno: "Interno",
    prefissoChiamata: "PrefissoChiamata",
    active: "Active",
    supervisorId: "SupervisorId",
    gruppoNome: "GruppoNome",
    gruppoMandanti: "GruppoMandantiJson",
    lavorazioneSuggerita: "LavorazioneSuggerita",
    postazioneId: "PostazioneId",
    postazioneFissa: "PostazioneFissa",
    sedeId: "SedeId",
    condizioneEconomica: "CondizioneEconomica",
    importoFisso: "ImportoFisso",
    lastLoginAt: "LastLoginAt",
    lastLogoutAt: "LastLogoutAt",
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
    if (v === null) {
      sets.push(`${col} = NULL`);
      continue;
    }
    if (k === "formazioneOnly" || k === "active" || k === "postazioneFissa") {
      req.input(p, sql.Bit, v ? 1 : 0);
    } else if (k === "annoNascita") {
      req.input(p, sql.SmallInt, v === null ? null : Number(v));
    } else if (k === "passwordChangedAt" || k === "lastLoginAt" || k === "lastLogoutAt") {
      req.input(p, sql.DateTime2(3), new Date(String(v)));
    } else if (k === "supervisorId" || k === "postazioneId" || k === "sedeId") {
      req.input(p, sql.UniqueIdentifier, String(v));
    } else if (k === "importoFisso") {
      req.input(p, sql.Decimal(18, 2), v === null ? null : Number(v));
    } else if (k === "email") {
      req.input(p, sql.NVarChar(320), String(v).toLowerCase());
    } else if (k === "gruppoMandanti" || k === "lavorazioneSuggerita") {
      req.input(p, sql.NVarChar(sql.MAX), String(v));
    } else {
      req.input(p, sql.NVarChar(500), String(v));
    }
    sets.push(`${col} = @${p}`);
  }
  if (!sets.length) return getUserById(cfg, tenantId, id);
  const res = await req.query(`
    UPDATE dbo.Users SET ${sets.join(", ")} OUTPUT INSERTED.*
    WHERE TenantId = @tenantId AND Id = @id
  `);
  return res.recordset[0] ? mapRow(res.recordset[0] as Record<string, unknown>) : null;
}

export async function updateManyUsers(
  cfg: ConnectorConfig["db"],
  tenantId: string,
  filter: UserFilter,
  data: Record<string, unknown>
) {
  const pool = await getPool(cfg);
  const req = pool.request();
  const where = bindFilter(req, tenantId, filter, "u");
  const sets: string[] = [];
  if (data.postazioneId !== undefined) {
    if (data.postazioneId === null) sets.push("PostazioneId = NULL");
    else {
      req.input("postazioneId", sql.UniqueIdentifier, data.postazioneId);
      sets.push("PostazioneId = @postazioneId");
    }
  }
  if (data.postazioneFissa !== undefined) {
    req.input("postazioneFissa", sql.Bit, data.postazioneFissa ? 1 : 0);
    sets.push("PostazioneFissa = @postazioneFissa");
  }
  if (data.sedeId !== undefined) {
    if (data.sedeId === null) sets.push("SedeId = NULL");
    else {
      req.input("sedeId", sql.UniqueIdentifier, data.sedeId);
      sets.push("SedeId = @sedeId");
    }
  }
  if (data.active !== undefined) {
    req.input("active", sql.Bit, data.active ? 1 : 0);
    sets.push("Active = @active");
  }
  if (!sets.length) return { count: 0 };
  const res = await req.query(`
    UPDATE u SET ${sets.join(", ")}
    FROM dbo.Users u
    WHERE ${where}
  `);
  return { count: Number(res.rowsAffected[0] ?? 0) };
}
