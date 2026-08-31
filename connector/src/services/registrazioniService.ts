import { sql, getPool } from "../db/pool.js";
import type { ConnectorConfig } from "../config.js";

export type RegistrazioneFilter = {
  none?: boolean;
  id?: string;
  praticaId?: string;
  praticaIdsIn?: string[];
  operatoreId?: string;
  operatoreIdIn?: string[];
  evidenzaBackOffice?: boolean;
  createdAtGte?: string;
  createdAtLte?: string;
  search?: string;
};

const REG_COLS = `
  r.Id, r.TenantId, r.PraticaId, r.OperatoreId, r.Numero, r.Direzione, r.Stato,
  r.Esito, r.DurataSec, r.FileName, r.EvidenzaBackOffice, r.CreatedAt
`;

function bindRegistrazioneFilter(
  req: sql.Request,
  tenantId: string,
  filter?: RegistrazioneFilter
): { where: string; join: string } {
  if (filter?.none) return { where: "1 = 0", join: "" };

  req.input("tenantId", sql.UniqueIdentifier, tenantId);
  const clauses = ["r.TenantId = @tenantId"];
  let join = "";

  if (filter?.id) {
    req.input("id", sql.UniqueIdentifier, filter.id);
    clauses.push("r.Id = @id");
  }
  if (filter?.praticaId) {
    req.input("praticaId", sql.UniqueIdentifier, filter.praticaId);
    clauses.push("r.PraticaId = @praticaId");
  }
  if (filter?.praticaIdsIn?.length) {
    filter.praticaIdsIn.forEach((id, i) => req.input(`pid${i}`, sql.UniqueIdentifier, id));
    clauses.push(`r.PraticaId IN (${filter.praticaIdsIn.map((_, i) => `@pid${i}`).join(", ")})`);
  }
  if (filter?.operatoreId) {
    req.input("operatoreId", sql.UniqueIdentifier, filter.operatoreId);
    clauses.push("r.OperatoreId = @operatoreId");
  }
  if (filter?.operatoreIdIn?.length) {
    filter.operatoreIdIn.forEach((id, i) => req.input(`op${i}`, sql.UniqueIdentifier, id));
    clauses.push(`r.OperatoreId IN (${filter.operatoreIdIn.map((_, i) => `@op${i}`).join(", ")})`);
  }
  if (filter?.evidenzaBackOffice === true) {
    clauses.push("r.EvidenzaBackOffice = 1");
  }
  if (filter?.createdAtGte) {
    req.input("createdAtGte", sql.DateTime2, new Date(filter.createdAtGte));
    clauses.push("r.CreatedAt >= @createdAtGte");
  }
  if (filter?.createdAtLte) {
    req.input("createdAtLte", sql.DateTime2, new Date(filter.createdAtLte));
    clauses.push("r.CreatedAt <= @createdAtLte");
  }
  if (filter?.search) {
    req.input("search", sql.NVarChar(200), `%${filter.search}%`);
    join = `
      INNER JOIN dbo.Pratiche p ON p.Id = r.PraticaId
      INNER JOIN dbo.Debitori d ON d.Id = p.DebitoreId
      LEFT JOIN dbo.Users u ON u.Id = r.OperatoreId
    `;
    clauses.push(`(
      p.Numero LIKE @search OR d.Cognome LIKE @search OR d.Nome LIKE @search OR u.Name LIKE @search
    )`);
  }

  return { where: clauses.join(" AND "), join };
}

export async function listRegistrazioni(
  cfg: ConnectorConfig["db"],
  req: {
    tenantId: string;
    filter?: RegistrazioneFilter;
    skip?: number;
    take?: number;
    includeOperatore?: boolean;
    includePraticaDebitore?: boolean;
  }
) {
  const pool = await getPool(cfg);
  const baseReq = pool.request();
  const { where, join } = bindRegistrazioneFilter(baseReq, req.tenantId, req.filter);
  const take = req.take ?? 5000;
  const skip = req.skip ?? 0;

  const countReq = pool.request();
  bindRegistrazioneFilter(countReq, req.tenantId, req.filter);
  const countRes = await countReq.query(`
    SELECT COUNT(*) AS Total FROM dbo.RegistrazioniChiamate r ${join} WHERE ${where}
  `);
  const total = Number(countRes.recordset[0]?.Total ?? 0);

  let extraJoin = join;
  let extraSelect = "";
  if (req.includeOperatore) {
    if (!extraJoin.includes("dbo.Users u")) {
      extraJoin += " LEFT JOIN dbo.Users u ON u.Id = r.OperatoreId ";
    }
    extraSelect += ", u.Id AS Operatore_Id, u.Name AS Operatore_Name";
  }
  if (req.includePraticaDebitore) {
    if (!extraJoin.includes("dbo.Pratiche p")) {
      extraJoin += " INNER JOIN dbo.Pratiche p ON p.Id = r.PraticaId ";
    }
    if (!extraJoin.includes("dbo.Debitori d")) {
      extraJoin += " INNER JOIN dbo.Debitori d ON d.Id = p.DebitoreId ";
    }
    extraSelect += ", p.Id AS Pratica_Id, p.Numero AS Pratica_Numero";
    extraSelect += ", d.Nome AS Debitore_Nome, d.Cognome AS Debitore_Cognome";
  }

  const listReq = pool.request();
  bindRegistrazioneFilter(listReq, req.tenantId, req.filter);
  listReq.input("skip", sql.Int, skip);
  listReq.input("take", sql.Int, take);

  const result = await listReq.query(`
    SELECT ${REG_COLS}${extraSelect}
    FROM dbo.RegistrazioniChiamate r
    ${extraJoin}
    WHERE ${where}
    ORDER BY r.CreatedAt DESC
    OFFSET @skip ROWS FETCH NEXT @take ROWS ONLY
  `);

  const items = result.recordset.map((row: Record<string, unknown>) => {
    const out: Record<string, unknown> = { ...row };
    if (req.includeOperatore) {
      out.operatore = { Id: row.Operatore_Id, Name: row.Operatore_Name };
    }
    if (req.includePraticaDebitore) {
      out.pratica = {
        Id: row.Pratica_Id,
        Numero: row.Pratica_Numero,
        debitore: { Nome: row.Debitore_Nome, Cognome: row.Debitore_Cognome },
      };
    }
    return out;
  });

  return { items, total };
}

export async function findFirstRegistrazione(
  cfg: ConnectorConfig["db"],
  tenantId: string,
  filter: RegistrazioneFilter
) {
  const pool = await getPool(cfg);
  const req = pool.request();
  const { where, join } = bindRegistrazioneFilter(req, tenantId, filter);
  const praticaJoin = join.includes("dbo.Pratiche p")
    ? join
    : `INNER JOIN dbo.Pratiche p ON p.Id = r.PraticaId ${join}`;
  const result = await req.query(`
    SELECT TOP 1 ${REG_COLS}, p.TenantId AS Pratica_TenantId
    FROM dbo.RegistrazioniChiamate r
    ${praticaJoin}
    WHERE ${where}
  `);
  const row = result.recordset[0];
  if (!row) return null;
  return {
    ...row,
    pratica: { TenantId: row.Pratica_TenantId },
  };
}

export async function createRegistrazione(
  cfg: ConnectorConfig["db"],
  tenantId: string,
  data: Record<string, unknown>
) {
  const pool = await getPool(cfg);
  const result = await pool
    .request()
    .input("tenantId", sql.UniqueIdentifier, tenantId)
    .input("praticaId", sql.UniqueIdentifier, data.praticaId)
    .input("operatoreId", sql.UniqueIdentifier, data.operatoreId)
    .input("numero", sql.NVarChar(30), data.numero)
    .input("direzione", sql.NVarChar(20), data.direzione ?? "uscita")
    .input("stato", sql.NVarChar(30), data.stato ?? "CONFERMATA_UI")
    .input("esito", sql.NVarChar(50), data.esito ?? null)
    .input("durataSec", sql.Int, data.durataSec ?? 0)
    .input("fileName", sql.NVarChar(300), data.fileName ?? "")
    .input("evidenzaBackOffice", sql.Bit, data.evidenzaBackOffice ? 1 : 0)
    .query(`
      INSERT INTO dbo.RegistrazioniChiamate (
        TenantId, PraticaId, OperatoreId, Numero, Direzione, Stato, Esito,
        DurataSec, FileName, EvidenzaBackOffice
      )
      OUTPUT INSERTED.*
      VALUES (
        @tenantId, @praticaId, @operatoreId, @numero, @direzione, @stato, @esito,
        @durataSec, @fileName, @evidenzaBackOffice
      )
    `);
  return result.recordset[0];
}

export async function deleteManyRegistrazioni(
  cfg: ConnectorConfig["db"],
  tenantId: string,
  filter: RegistrazioneFilter
) {
  const pool = await getPool(cfg);
  const req = pool.request();
  const { where, join } = bindRegistrazioneFilter(req, tenantId, filter);
  const res = await req.query(`
    DELETE r FROM dbo.RegistrazioniChiamate r ${join} WHERE ${where}
  `);
  return { count: res.rowsAffected[0] ?? 0 };
}
