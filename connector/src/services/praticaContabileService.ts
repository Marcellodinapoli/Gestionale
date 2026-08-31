import { sql, getPool } from "../db/pool.js";
import type { ConnectorConfig } from "../config.js";

export async function createFattura(
  cfg: ConnectorConfig["db"],
  tenantId: string,
  data: Record<string, unknown>
) {
  const pool = await getPool(cfg);
  const result = await pool
    .request()
    .input("tenantId", sql.UniqueIdentifier, tenantId)
    .input("praticaId", sql.UniqueIdentifier, data.praticaId)
    .input("numero", sql.NVarChar(50), data.numero)
    .input("causale", sql.NVarChar(500), data.causale ?? "")
    .input("dataFattura", sql.DateTime2, new Date(String(data.dataFattura)))
    .input("dataScadenza", sql.DateTime2, new Date(String(data.dataScadenza)))
    .input("importo", sql.Decimal(18, 2), data.importo)
    .input("pagato", sql.Decimal(18, 2), data.pagato ?? 0)
    .query(`
      INSERT INTO dbo.Fatture (TenantId, PraticaId, Numero, Causale, DataFattura, DataScadenza, Importo, Pagato)
      OUTPUT INSERTED.*
      VALUES (@tenantId, @praticaId, @numero, @causale, @dataFattura, @dataScadenza, @importo, @pagato)
    `);
  return result.recordset[0];
}

export async function deleteFattureByPratica(
  cfg: ConnectorConfig["db"],
  tenantId: string,
  praticaId: string
) {
  const pool = await getPool(cfg);
  const res = await pool
    .request()
    .input("tenantId", sql.UniqueIdentifier, tenantId)
    .input("praticaId", sql.UniqueIdentifier, praticaId)
    .query(`DELETE FROM dbo.Fatture WHERE TenantId = @tenantId AND PraticaId = @praticaId`);
  return { count: res.rowsAffected[0] ?? 0 };
}

export async function createDocumento(
  cfg: ConnectorConfig["db"],
  tenantId: string,
  data: Record<string, unknown>
) {
  const pool = await getPool(cfg);
  const result = await pool
    .request()
    .input("tenantId", sql.UniqueIdentifier, tenantId)
    .input("praticaId", sql.UniqueIdentifier, data.praticaId)
    .input("nome", sql.NVarChar(300), data.nome)
    .input("tipo", sql.NVarChar(50), data.tipo ?? "allegato")
    .input("path", sql.NVarChar(500), data.path ?? null)
    .query(`
      INSERT INTO dbo.Documenti (TenantId, PraticaId, Nome, Tipo, Path)
      OUTPUT INSERTED.*
      VALUES (@tenantId, @praticaId, @nome, @tipo, @path)
    `);
  return result.recordset[0];
}

export async function deleteDocumentiByPratica(
  cfg: ConnectorConfig["db"],
  tenantId: string,
  praticaId: string
) {
  const pool = await getPool(cfg);
  const res = await pool
    .request()
    .input("tenantId", sql.UniqueIdentifier, tenantId)
    .input("praticaId", sql.UniqueIdentifier, praticaId)
    .query(`DELETE FROM dbo.Documenti WHERE TenantId = @tenantId AND PraticaId = @praticaId`);
  return { count: res.rowsAffected[0] ?? 0 };
}

export async function createPianoRata(
  cfg: ConnectorConfig["db"],
  tenantId: string,
  data: Record<string, unknown>
) {
  const pool = await getPool(cfg);
  const result = await pool
    .request()
    .input("tenantId", sql.UniqueIdentifier, tenantId)
    .input("praticaId", sql.UniqueIdentifier, data.praticaId)
    .input("numeroRata", sql.Int, data.numeroRata)
    .input("importo", sql.Decimal(18, 2), data.importo)
    .input("scadenza", sql.DateTime2, new Date(String(data.scadenza)))
    .input("pagata", sql.Bit, data.pagata ? 1 : 0)
    .query(`
      INSERT INTO dbo.PianoRate (TenantId, PraticaId, NumeroRata, Importo, Scadenza, Pagata)
      OUTPUT INSERTED.*
      VALUES (@tenantId, @praticaId, @numeroRata, @importo, @scadenza, @pagata)
    `);
  return result.recordset[0];
}

export async function createManyPianoRate(
  cfg: ConnectorConfig["db"],
  tenantId: string,
  items: Record<string, unknown>[]
) {
  let count = 0;
  for (const item of items) {
    await createPianoRata(cfg, tenantId, item);
    count++;
  }
  return { count };
}

export async function deletePianoRateByPratica(
  cfg: ConnectorConfig["db"],
  tenantId: string,
  praticaId: string
) {
  const pool = await getPool(cfg);
  const res = await pool
    .request()
    .input("tenantId", sql.UniqueIdentifier, tenantId)
    .input("praticaId", sql.UniqueIdentifier, praticaId)
    .query(`DELETE FROM dbo.PianoRate WHERE TenantId = @tenantId AND PraticaId = @praticaId`);
  return { count: res.rowsAffected[0] ?? 0 };
}
