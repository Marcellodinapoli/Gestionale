import { sql, getPool } from "../db/pool.js";
import type { ConnectorConfig } from "../config.js";

export type ImportBatchRow = {
  id: string;
  tenantId: string;
  tipo: string;
  mandanteId: string;
  mandanteCodice: string;
  perimetro: string;
  lotto: string;
  affidoIl: string;
  scadenzaMandato: string | null;
  fileName: string | null;
  nPratiche: number;
  createdById: string | null;
  createdByName: string | null;
  createdAt: string;
};

function mapRow(r: Record<string, unknown>): ImportBatchRow {
  return {
    id: String(r.Id),
    tenantId: String(r.TenantId),
    tipo: String(r.Tipo),
    mandanteId: String(r.MandanteId),
    mandanteCodice: String(r.MandanteCodice),
    perimetro: String(r.Perimetro),
    lotto: String(r.Lotto),
    affidoIl: new Date(String(r.AffidoIl)).toISOString(),
    scadenzaMandato: r.ScadenzaMandato ? new Date(String(r.ScadenzaMandato)).toISOString() : null,
    fileName: r.FileName != null ? String(r.FileName) : null,
    nPratiche: Number(r.NPratiche ?? 0),
    createdById: r.CreatedById != null ? String(r.CreatedById) : null,
    createdByName: r.CreatedByName != null ? String(r.CreatedByName) : null,
    createdAt: new Date(String(r.CreatedAt)).toISOString(),
  };
}

export async function findImportBatchByLotKey(
  cfg: ConnectorConfig["db"],
  tenantId: string,
  input: { mandanteId: string; perimetro: string; lotto: string; tipo?: string }
) {
  const pool = await getPool(cfg);
  const res = await pool
    .request()
    .input("tenantId", sql.UniqueIdentifier, tenantId)
    .input("tipo", sql.NVarChar(30), input.tipo ?? "PRATICHE")
    .input("mandanteId", sql.UniqueIdentifier, input.mandanteId)
    .input("perimetro", sql.NVarChar(100), input.perimetro)
    .input("lotto", sql.NVarChar(100), input.lotto)
    .query(`
      SELECT TOP 1 * FROM dbo.ImportBatch
      WHERE TenantId = @tenantId AND Tipo = @tipo
        AND MandanteId = @mandanteId AND Perimetro = @perimetro AND Lotto = @lotto
      ORDER BY CreatedAt DESC
    `);
  return res.recordset[0] ? mapRow(res.recordset[0] as Record<string, unknown>) : null;
}

export async function getImportBatchById(cfg: ConnectorConfig["db"], tenantId: string, id: string) {
  const pool = await getPool(cfg);
  const res = await pool
    .request()
    .input("tenantId", sql.UniqueIdentifier, tenantId)
    .input("id", sql.UniqueIdentifier, id)
    .query(`SELECT * FROM dbo.ImportBatch WHERE TenantId = @tenantId AND Id = @id`);
  return res.recordset[0] ? mapRow(res.recordset[0] as Record<string, unknown>) : null;
}

export async function listImportBatches(
  cfg: ConnectorConfig["db"],
  tenantId: string,
  filter?: { tipo?: string; take?: number }
) {
  const pool = await getPool(cfg);
  const req = pool.request();
  req.input("tenantId", sql.UniqueIdentifier, tenantId);
  req.input("take", sql.Int, Math.min(filter?.take ?? 50, 100));
  const tipo = filter?.tipo ?? "PRATICHE";
  req.input("tipo", sql.NVarChar(30), tipo);
  const res = await req.query(`
    SELECT TOP (@take) * FROM dbo.ImportBatch
    WHERE TenantId = @tenantId AND Tipo = @tipo
    ORDER BY CreatedAt DESC
  `);
  return res.recordset.map((r) => mapRow(r as Record<string, unknown>));
}

export async function createImportBatch(
  cfg: ConnectorConfig["db"],
  tenantId: string,
  data: {
    tipo?: string;
    mandanteId: string;
    mandanteCodice: string;
    perimetro: string;
    lotto: string;
    affidoIl: string | Date;
    scadenzaMandato?: string | Date | null;
    fileName?: string | null;
    nPratiche?: number;
    createdById?: string | null;
    createdByName?: string | null;
  }
) {
  const pool = await getPool(cfg);
  const res = await pool
    .request()
    .input("tenantId", sql.UniqueIdentifier, tenantId)
    .input("tipo", sql.NVarChar(30), data.tipo ?? "PRATICHE")
    .input("mandanteId", sql.UniqueIdentifier, data.mandanteId)
    .input("mandanteCodice", sql.NVarChar(50), data.mandanteCodice)
    .input("perimetro", sql.NVarChar(100), data.perimetro)
    .input("lotto", sql.NVarChar(100), data.lotto)
    .input("affidoIl", sql.DateTime2, new Date(data.affidoIl))
    .input("nPratiche", sql.Int, data.nPratiche ?? 0)
    .input("createdByName", sql.NVarChar(200), data.createdByName ?? null)
    .input("fileName", sql.NVarChar(300), data.fileName ?? null)
    .input(
      "scadenzaMandato",
      sql.DateTime2,
      data.scadenzaMandato ? new Date(data.scadenzaMandato) : null
    )
    .input("createdById", sql.UniqueIdentifier, data.createdById ?? null)
    .query(`
      INSERT INTO dbo.ImportBatch (
        TenantId, Tipo, MandanteId, MandanteCodice, Perimetro, Lotto, AffidoIl,
        ScadenzaMandato, FileName, NPratiche, CreatedById, CreatedByName, CreatedAt
      )
      OUTPUT INSERTED.*
      VALUES (
        @tenantId, @tipo, @mandanteId, @mandanteCodice, @perimetro, @lotto, @affidoIl,
        @scadenzaMandato, @fileName, @nPratiche, @createdById, @createdByName, SYSUTCDATETIME()
      )
    `);
  return mapRow(res.recordset[0] as Record<string, unknown>);
}

export async function updateImportBatch(
  cfg: ConnectorConfig["db"],
  tenantId: string,
  id: string,
  data: { nPratiche?: number; fileName?: string | null; scadenzaMandato?: string | Date | null }
) {
  const pool = await getPool(cfg);
  const sets: string[] = [];
  const req = pool.request()
    .input("tenantId", sql.UniqueIdentifier, tenantId)
    .input("id", sql.UniqueIdentifier, id);
  if (data.nPratiche != null) {
    req.input("nPratiche", sql.Int, data.nPratiche);
    sets.push("NPratiche = @nPratiche");
  }
  if (data.fileName !== undefined) {
    req.input("fileName", sql.NVarChar(300), data.fileName);
    sets.push("FileName = @fileName");
  }
  if (data.scadenzaMandato !== undefined) {
    req.input("scadenzaMandato", sql.DateTime2, data.scadenzaMandato ? new Date(data.scadenzaMandato) : null);
    sets.push("ScadenzaMandato = @scadenzaMandato");
  }
  if (!sets.length) return getImportBatchById(cfg, tenantId, id);
  await req.query(`UPDATE dbo.ImportBatch SET ${sets.join(", ")} WHERE TenantId = @tenantId AND Id = @id`);
  return getImportBatchById(cfg, tenantId, id);
}

export async function deleteImportBatch(cfg: ConnectorConfig["db"], tenantId: string, id: string) {
  const pool = await getPool(cfg);
  await pool
    .request()
    .input("tenantId", sql.UniqueIdentifier, tenantId)
    .input("id", sql.UniqueIdentifier, id)
    .query(`DELETE FROM dbo.ImportBatch WHERE TenantId = @tenantId AND Id = @id`);
}

export async function countPraticheImportBatch(
  cfg: ConnectorConfig["db"],
  tenantId: string,
  input: { mandanteId: string; lotto: string; affidoIl: string | Date }
) {
  const pool = await getPool(cfg);
  const affido = new Date(input.affidoIl);
  const start = new Date(affido);
  start.setHours(0, 0, 0, 0);
  const end = new Date(affido);
  end.setHours(23, 59, 59, 999);
  const res = await pool
    .request()
    .input("tenantId", sql.UniqueIdentifier, tenantId)
    .input("mandanteId", sql.UniqueIdentifier, input.mandanteId)
    .input("lotto", sql.NVarChar(100), input.lotto)
    .input("affidoStart", sql.DateTime2, start)
    .input("affidoEnd", sql.DateTime2, end)
    .query(`
      SELECT COUNT(*) AS total FROM dbo.Pratiche
      WHERE TenantId = @tenantId AND MandanteId = @mandanteId
        AND NumeroMandante = @lotto
        AND DataAffido >= @affidoStart AND DataAffido <= @affidoEnd
    `);
  return res.recordset[0]?.total ?? 0;
}

export async function linkPraticheToImportBatch(
  cfg: ConnectorConfig["db"],
  tenantId: string,
  input: { batchId: string; mandanteId: string; lotto: string; affidoIl: string | Date }
) {
  const pool = await getPool(cfg);
  const affido = new Date(input.affidoIl);
  const start = new Date(affido);
  start.setHours(0, 0, 0, 0);
  const end = new Date(affido);
  end.setHours(23, 59, 59, 999);
  await pool
    .request()
    .input("tenantId", sql.UniqueIdentifier, tenantId)
    .input("batchId", sql.UniqueIdentifier, input.batchId)
    .input("mandanteId", sql.UniqueIdentifier, input.mandanteId)
    .input("lotto", sql.NVarChar(100), input.lotto)
    .input("affidoStart", sql.DateTime2, start)
    .input("affidoEnd", sql.DateTime2, end)
    .query(`
      UPDATE dbo.Pratiche SET ImportBatchId = @batchId, UpdatedAt = SYSUTCDATETIME()
      WHERE TenantId = @tenantId AND MandanteId = @mandanteId
        AND NumeroMandante = @lotto
        AND DataAffido >= @affidoStart AND DataAffido <= @affidoEnd
        AND (ImportBatchId IS NULL OR ImportBatchId <> @batchId)
    `);
  const total = await countPraticheImportBatch(cfg, tenantId, input);
  return { totale: total };
}

/** Elimina pratica import (Provvigioni + Pratica; FK CASCADE sul resto). */
export async function deletePraticaForImport(
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
      DELETE FROM dbo.Provvigioni WHERE TenantId = @tenantId AND PraticaId = @praticaId
    `);
    await req.query(`
      DELETE FROM dbo.Pratiche WHERE TenantId = @tenantId AND Id = @praticaId
    `);
    await tx.commit();
  } catch (err) {
    await tx.rollback();
    throw err;
  }
}
