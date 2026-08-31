import { sql, getPool } from "../db/pool.js";
import type { ConnectorConfig } from "../config.js";

const GARANTE_COLS = `
  g.Id, g.TenantId, g.PraticaId, g.Nome, g.Cognome, g.CodiceFiscale, g.Telefono, g.TelefonoStato,
  g.Email, g.Indirizzo, g.Citta, g.Cap, g.Provincia, g.Ordine, g.CreatedAt
`;

export async function findFirstGarante(
  cfg: ConnectorConfig["db"],
  filter: { id?: string; praticaId?: string }
) {
  const pool = await getPool(cfg);
  const req = pool.request();
  const clauses: string[] = [];
  if (filter.id) {
    req.input("id", sql.UniqueIdentifier, filter.id);
    clauses.push("Id = @id");
  }
  if (filter.praticaId) {
    req.input("praticaId", sql.UniqueIdentifier, filter.praticaId);
    clauses.push("PraticaId = @praticaId");
  }
  if (!clauses.length) return null;
  const result = await req.query(`
    SELECT TOP 1 ${GARANTE_COLS} FROM dbo.Garanti WHERE ${clauses.join(" AND ")}
  `);
  return result.recordset[0] ?? null;
}

export async function findGarantiByCf(
  cfg: ConnectorConfig["db"],
  tenantId: string,
  variants: string[]
) {
  if (!variants.length) return [];
  const pool = await getPool(cfg);
  const req = pool.request();
  req.input("tenantId", sql.UniqueIdentifier, tenantId);
  variants.forEach((v, i) => req.input(`cf${i}`, sql.NVarChar(20), v));
  const result = await req.query(`
    SELECT PraticaId, CodiceFiscale FROM dbo.Garanti
    WHERE TenantId = @tenantId AND CodiceFiscale IN (${variants.map((_, i) => `@cf${i}`).join(", ")})
  `);
  return result.recordset;
}

export async function updateGarante(
  cfg: ConnectorConfig["db"],
  tenantId: string,
  id: string,
  data: Record<string, unknown>
) {
  const pool = await getPool(cfg);
  const req = pool.request();
  req.input("tenantId", sql.UniqueIdentifier, tenantId);
  req.input("id", sql.UniqueIdentifier, id);
  const sets: string[] = [];
  if (data.telefono !== undefined) {
    req.input("telefono", sql.NVarChar(30), data.telefono);
    sets.push("Telefono = @telefono");
  }
  if (data.email !== undefined) {
    req.input("email", sql.NVarChar(200), data.email);
    sets.push("Email = @email");
  }
  if (data.telefonoStato !== undefined) {
    req.input("telefonoStato", sql.NVarChar(30), data.telefonoStato);
    sets.push("TelefonoStato = @telefonoStato");
  }
  if (!sets.length) return findFirstGarante(cfg, { id });
  const result = await req.query(`
    UPDATE dbo.Garanti SET ${sets.join(", ")}
    OUTPUT INSERTED.*
    WHERE Id = @id AND TenantId = @tenantId
  `);
  return result.recordset[0] ?? null;
}

export async function deleteGarantiByPratica(
  cfg: ConnectorConfig["db"],
  tenantId: string,
  praticaId: string
) {
  const pool = await getPool(cfg);
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    const req = new sql.Request(tx);
    req.input("tenantId", sql.UniqueIdentifier, tenantId);
    req.input("praticaId", sql.UniqueIdentifier, praticaId);
    await req.query(`
      DELETE gr FROM dbo.GaranteRecapiti gr
      INNER JOIN dbo.Garanti g ON g.Id = gr.GaranteId
      WHERE g.TenantId = @tenantId AND g.PraticaId = @praticaId
    `);
    await req.query(`DELETE FROM dbo.Garanti WHERE TenantId = @tenantId AND PraticaId = @praticaId`);
    await tx.commit();
  } catch (err) {
    await tx.rollback();
    throw err;
  }
}

export async function countGaranteRecapiti(
  cfg: ConnectorConfig["db"],
  garanteId: string,
  tipo?: string
) {
  const pool = await getPool(cfg);
  const req = pool.request().input("garanteId", sql.UniqueIdentifier, garanteId);
  let where = "GaranteId = @garanteId";
  if (tipo) {
    req.input("tipo", sql.NVarChar(30), tipo);
    where += " AND Tipo = @tipo";
  }
  const result = await req.query(`SELECT COUNT(*) AS C FROM dbo.GaranteRecapiti WHERE ${where}`);
  return Number(result.recordset[0]?.C ?? 0);
}

export async function findFirstGaranteRecapito(
  cfg: ConnectorConfig["db"],
  filter: { id?: string; garanteId?: string; tipo?: string }
) {
  const pool = await getPool(cfg);
  const req = pool.request();
  const clauses: string[] = [];
  if (filter.id) {
    req.input("id", sql.UniqueIdentifier, filter.id);
    clauses.push("Id = @id");
  }
  if (filter.garanteId) {
    req.input("garanteId", sql.UniqueIdentifier, filter.garanteId);
    clauses.push("GaranteId = @garanteId");
  }
  if (filter.tipo) {
    req.input("tipo", sql.NVarChar(30), filter.tipo);
    clauses.push("Tipo = @tipo");
  }
  if (!clauses.length) return null;
  const result = await req.query(`
    SELECT TOP 1 * FROM dbo.GaranteRecapiti WHERE ${clauses.join(" AND ")}
  `);
  return result.recordset[0] ?? null;
}

export async function createGaranteRecapito(
  cfg: ConnectorConfig["db"],
  data: { garanteId: string; tipo: string; valore: string; ordine?: number; stato?: string | null }
) {
  const pool = await getPool(cfg);
  const result = await pool
    .request()
    .input("garanteId", sql.UniqueIdentifier, data.garanteId)
    .input("tipo", sql.NVarChar(30), data.tipo)
    .input("valore", sql.NVarChar(200), data.valore)
    .input("ordine", sql.Int, data.ordine ?? 1)
    .input("stato", sql.NVarChar(30), data.stato ?? null)
    .query(`
      INSERT INTO dbo.GaranteRecapiti (GaranteId, Tipo, Valore, Ordine, Stato)
      OUTPUT INSERTED.*
      VALUES (@garanteId, @tipo, @valore, @ordine, @stato)
    `);
  return result.recordset[0];
}

export async function updateGaranteRecapito(
  cfg: ConnectorConfig["db"],
  id: string,
  data: Record<string, unknown>
) {
  const pool = await getPool(cfg);
  const req = pool.request().input("id", sql.UniqueIdentifier, id);
  const sets: string[] = [];
  if (data.valore !== undefined) {
    req.input("valore", sql.NVarChar(200), data.valore);
    sets.push("Valore = @valore");
  }
  if (data.stato !== undefined) {
    req.input("stato", sql.NVarChar(30), data.stato);
    sets.push("Stato = @stato");
  }
  if (data.ordine !== undefined) {
    req.input("ordine", sql.Int, data.ordine);
    sets.push("Ordine = @ordine");
  }
  if (!sets.length) return findFirstGaranteRecapito(cfg, { id });
  const result = await req.query(`
    UPDATE dbo.GaranteRecapiti SET ${sets.join(", ")} OUTPUT INSERTED.* WHERE Id = @id
  `);
  return result.recordset[0] ?? null;
}

export async function deleteGaranteRecapito(cfg: ConnectorConfig["db"], id: string) {
  await getPool(cfg).then((pool) =>
    pool.request().input("id", sql.UniqueIdentifier, id).query(`DELETE FROM dbo.GaranteRecapiti WHERE Id = @id`)
  );
}

export async function deleteGaranteRecapitiByGarante(cfg: ConnectorConfig["db"], garanteId: string) {
  await getPool(cfg).then((pool) =>
    pool
      .request()
      .input("garanteId", sql.UniqueIdentifier, garanteId)
      .query(`DELETE FROM dbo.GaranteRecapiti WHERE GaranteId = @garanteId`)
  );
}
