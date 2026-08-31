import { sql, getPool } from "../db/pool.js";
import type { ConnectorConfig } from "../config.js";

export type ProvvigioneFilter = {
  tenantId?: string;
  none?: boolean;
  id?: string;
  idsIn?: string[];
  praticaId?: string;
  operatoreId?: string;
  operatoreIdIn?: string[];
  operatoreSedeId?: string;
  operatoreOrSupervisorId?: string;
  stato?: string;
  createdAtGte?: string;
  createdAtLte?: string;
  praticaMandanteId?: string;
  praticaNumeroMandante?: string;
  praticaNumeroMandanteNull?: boolean;
  perimetroOr?: Array<{ mandanteId: string; numeriMandante?: string[] }>;
};

const PROVV_COLS = `
  pv.Id, pv.TenantId, pv.IncassoId, pv.PraticaId, pv.OperatoreId,
  pv.BaseImporto, pv.Percentuale, pv.Importo, pv.Stato, pv.LiquidataAt, pv.CreatedAt
`;

function bindProvvigioneFilter(
  req: sql.Request,
  tenantId: string,
  filter?: ProvvigioneFilter
): { where: string; join: string } {
  if (filter?.none) return { where: "1 = 0", join: "" };

  req.input("tenantId", sql.UniqueIdentifier, tenantId);
  const clauses = ["pv.TenantId = @tenantId"];
  let join = "";

  if (filter?.id) {
    req.input("id", sql.UniqueIdentifier, filter.id);
    clauses.push("pv.Id = @id");
  }
  if (filter?.idsIn?.length) {
    filter.idsIn.forEach((id, i) => req.input(`id${i}`, sql.UniqueIdentifier, id));
    clauses.push(`pv.Id IN (${filter.idsIn.map((_, i) => `@id${i}`).join(", ")})`);
  }
  if (filter?.praticaId) {
    req.input("praticaId", sql.UniqueIdentifier, filter.praticaId);
    clauses.push("pv.PraticaId = @praticaId");
  }
  if (filter?.operatoreId) {
    req.input("operatoreId", sql.UniqueIdentifier, filter.operatoreId);
    clauses.push("pv.OperatoreId = @operatoreId");
  }
  if (filter?.operatoreIdIn?.length) {
    filter.operatoreIdIn.forEach((id, i) => req.input(`op${i}`, sql.UniqueIdentifier, id));
    clauses.push(`pv.OperatoreId IN (${filter.operatoreIdIn.map((_, i) => `@op${i}`).join(", ")})`);
  }
  if (filter?.stato) {
    req.input("stato", sql.NVarChar(30), filter.stato);
    clauses.push("pv.Stato = @stato");
  }
  if (filter?.createdAtGte) {
    req.input("createdAtGte", sql.DateTime2, new Date(filter.createdAtGte));
    clauses.push("pv.CreatedAt >= @createdAtGte");
  }
  if (filter?.createdAtLte) {
    req.input("createdAtLte", sql.DateTime2, new Date(filter.createdAtLte));
    clauses.push("pv.CreatedAt <= @createdAtLte");
  }

  const needsOperatoreJoin = filter?.operatoreSedeId || filter?.operatoreOrSupervisorId;
  if (needsOperatoreJoin) {
    join += " INNER JOIN dbo.Users u ON u.Id = pv.OperatoreId ";
    if (filter?.operatoreSedeId) {
      req.input("operatoreSedeId", sql.UniqueIdentifier, filter.operatoreSedeId);
      clauses.push("u.SedeId = @operatoreSedeId");
    }
    if (filter?.operatoreOrSupervisorId) {
      req.input("operatoreOrSupervisorId", sql.UniqueIdentifier, filter.operatoreOrSupervisorId);
      clauses.push("(u.Id = @operatoreOrSupervisorId OR u.SupervisorId = @operatoreOrSupervisorId)");
    }
  }

  const needsPraticaJoin =
    filter?.praticaMandanteId ||
    filter?.praticaNumeroMandante ||
    filter?.praticaNumeroMandanteNull ||
    filter?.perimetroOr?.length;
  if (needsPraticaJoin) {
    join += " INNER JOIN dbo.Pratiche p ON p.Id = pv.PraticaId ";
    if (filter?.praticaMandanteId) {
      req.input("praticaMandanteId", sql.UniqueIdentifier, filter.praticaMandanteId);
      clauses.push("p.MandanteId = @praticaMandanteId");
    }
    if (filter?.praticaNumeroMandante) {
      req.input("praticaNumeroMandante", sql.NVarChar(100), filter.praticaNumeroMandante);
      clauses.push("p.NumeroMandante = @praticaNumeroMandante");
    }
    if (filter?.praticaNumeroMandanteNull) {
      clauses.push("(p.NumeroMandante IS NULL OR p.NumeroMandante = N'')");
    }
    if (filter?.perimetroOr?.length) {
      const orParts: string[] = [];
      filter.perimetroOr.forEach((pair, i) => {
        req.input(`pmId${i}`, sql.UniqueIdentifier, pair.mandanteId);
        if (pair.numeriMandante?.length) {
          pair.numeriMandante.forEach((n, j) =>
            req.input(`pnm${i}_${j}`, sql.NVarChar(100), n)
          );
          orParts.push(
            `(p.MandanteId = @pmId${i} AND p.NumeroMandante IN (${pair.numeriMandante.map((_, j) => `@pnm${i}_${j}`).join(", ")}))`
          );
        } else {
          orParts.push(`p.MandanteId = @pmId${i}`);
        }
      });
      if (orParts.length) clauses.push(`(${orParts.join(" OR ")})`);
    }
  }

  return { where: clauses.join(" AND "), join };
}

export async function listProvvigioni(
  cfg: ConnectorConfig["db"],
  req: {
    tenantId: string;
    filter?: ProvvigioneFilter;
    skip?: number;
    take?: number;
    includeOperatore?: boolean;
    includePraticaDebitore?: boolean;
    includeIncasso?: boolean;
  }
) {
  const pool = await getPool(cfg);
  const baseReq = pool.request();
  const { where, join } = bindProvvigioneFilter(baseReq, req.tenantId, req.filter);
  const take = req.take ?? 5000;
  const skip = req.skip ?? 0;

  const countReq = pool.request();
  bindProvvigioneFilter(countReq, req.tenantId, req.filter);
  const countRes = await countReq.query(`
    SELECT COUNT(*) AS Total FROM dbo.Provvigioni pv ${join} WHERE ${where}
  `);
  const total = Number(countRes.recordset[0]?.Total ?? 0);

  let extraJoin = join;
  let extraSelect = "";
  if (req.includeOperatore) {
    if (!extraJoin.includes("dbo.Users u")) {
      extraJoin += " LEFT JOIN dbo.Users u ON u.Id = pv.OperatoreId ";
    }
    extraSelect += ", u.Name AS Operatore_Name";
  }
  if (req.includePraticaDebitore) {
    if (!extraJoin.includes("dbo.Pratiche p")) {
      extraJoin += " INNER JOIN dbo.Pratiche p ON p.Id = pv.PraticaId ";
    }
    extraJoin += " INNER JOIN dbo.Debitori d ON d.Id = p.DebitoreId ";
    extraSelect += ", p.Numero AS Pratica_Numero, p.NumeroMandante AS Pratica_NumeroMandante";
    extraSelect += ", d.Nome AS Debitore_Nome, d.Cognome AS Debitore_Cognome";
  }
  if (req.includeIncasso) {
    extraJoin += " INNER JOIN dbo.Incassi inc ON inc.Id = pv.IncassoId ";
    extraSelect += ", inc.Data AS Incasso_Data, inc.Importo AS Incasso_Importo, inc.Metodo AS Incasso_Metodo";
  }

  const listReq = pool.request();
  bindProvvigioneFilter(listReq, req.tenantId, req.filter);
  listReq.input("skip", sql.Int, skip);
  listReq.input("take", sql.Int, take);

  const result = await listReq.query(`
    SELECT ${PROVV_COLS}${extraSelect}
    FROM dbo.Provvigioni pv
    ${extraJoin}
    WHERE ${where}
    ORDER BY pv.CreatedAt DESC
    OFFSET @skip ROWS FETCH NEXT @take ROWS ONLY
  `);

  const items = result.recordset.map((row: Record<string, unknown>) => {
    const out: Record<string, unknown> = { ...row };
    if (req.includeOperatore && row.Operatore_Name != null) {
      out.operatore = { Name: row.Operatore_Name };
    }
    if (req.includePraticaDebitore) {
      out.pratica = {
        Numero: row.Pratica_Numero,
        NumeroMandante: row.Pratica_NumeroMandante,
        debitore: { Nome: row.Debitore_Nome, Cognome: row.Debitore_Cognome },
      };
    }
    if (req.includeIncasso) {
      out.incasso = {
        Data: row.Incasso_Data,
        Importo: row.Incasso_Importo,
        Metodo: row.Incasso_Metodo,
      };
    }
    return out;
  });

  return { items, total };
}

export async function aggregateProvvigioni(
  cfg: ConnectorConfig["db"],
  tenantId: string,
  filter?: ProvvigioneFilter
) {
  const pool = await getPool(cfg);
  const req = pool.request();
  const { where, join } = bindProvvigioneFilter(req, tenantId, filter);
  const res = await req.query(`
    SELECT ISNULL(SUM(pv.Importo), 0) AS ImportoSum, COUNT(*) AS Cnt
    FROM dbo.Provvigioni pv ${join} WHERE ${where}
  `);
  return {
    _sum: { importo: Number(res.recordset[0]?.ImportoSum ?? 0) },
    _count: Number(res.recordset[0]?.Cnt ?? 0),
  };
}

export async function groupByProvvigioni(
  cfg: ConnectorConfig["db"],
  tenantId: string,
  filter: ProvvigioneFilter | undefined,
  by: ("operatoreId" | "stato")[]
) {
  const pool = await getPool(cfg);
  const req = pool.request();
  const { where, join } = bindProvvigioneFilter(req, tenantId, filter);
  const cols = by.map((b) => (b === "operatoreId" ? "pv.OperatoreId" : "pv.Stato")).join(", ");
  const res = await req.query(`
    SELECT ${cols},
      ISNULL(SUM(pv.Importo), 0) AS ImportoSum,
      COUNT(*) AS Cnt
    FROM dbo.Provvigioni pv ${join}
    WHERE ${where}
    GROUP BY ${cols}
  `);
  return res.recordset.map((row: Record<string, unknown>) => ({
    operatoreId: by.includes("operatoreId") ? String(row.OperatoreId) : undefined,
    stato: by.includes("stato") ? String(row.Stato) : undefined,
    _sum: { importo: Number(row.ImportoSum ?? 0) },
    _count: Number(row.Cnt ?? 0),
  }));
}

export async function updateProvvigione(
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
  if (data.stato !== undefined) {
    req.input("stato", sql.NVarChar(30), data.stato);
    sets.push("Stato = @stato");
  }
  if (data.importo !== undefined) {
    req.input("importo", sql.Decimal(18, 2), data.importo);
    sets.push("Importo = @importo");
  }
  if (data.percentuale !== undefined) {
    req.input("percentuale", sql.Decimal(8, 4), data.percentuale);
    sets.push("Percentuale = @percentuale");
  }
  if (data.liquidataAt !== undefined) {
    req.input("liquidataAt", sql.DateTime2, data.liquidataAt ? new Date(String(data.liquidataAt)) : null);
    sets.push("LiquidataAt = @liquidataAt");
  }
  if (!sets.length) return null;
  const res = await req.query(`
    UPDATE dbo.Provvigioni SET ${sets.join(", ")}
    OUTPUT INSERTED.*
    WHERE Id = @id AND TenantId = @tenantId
  `);
  return res.recordset[0] ?? null;
}

export async function updateManyProvvigioni(
  cfg: ConnectorConfig["db"],
  tenantId: string,
  filter: ProvvigioneFilter,
  data: Record<string, unknown>
) {
  const pool = await getPool(cfg);
  const req = pool.request();
  const { where, join } = bindProvvigioneFilter(req, tenantId, filter);
  const sets: string[] = [];
  if (data.stato !== undefined) {
    req.input("stato", sql.NVarChar(30), data.stato);
    sets.push("pv.Stato = @stato");
  }
  if (data.importo !== undefined) {
    req.input("importo", sql.Decimal(18, 2), data.importo);
    sets.push("pv.Importo = @importo");
  }
  if (data.percentuale !== undefined) {
    req.input("percentuale", sql.Decimal(8, 4), data.percentuale);
    sets.push("pv.Percentuale = @percentuale");
  }
  if (data.liquidataAt !== undefined) {
    req.input("liquidataAt", sql.DateTime2, data.liquidataAt ? new Date(String(data.liquidataAt)) : null);
    sets.push("pv.LiquidataAt = @liquidataAt");
  }
  if (!sets.length) return { count: 0 };
  const res = await req.query(`
    UPDATE pv SET ${sets.join(", ")}
    FROM dbo.Provvigioni pv ${join}
    WHERE ${where}
  `);
  return { count: res.rowsAffected[0] ?? 0 };
}

export async function deleteManyProvvigioni(
  cfg: ConnectorConfig["db"],
  tenantId: string,
  filter: ProvvigioneFilter
) {
  const pool = await getPool(cfg);
  const req = pool.request();
  const { where, join } = bindProvvigioneFilter(req, tenantId, filter);
  const res = await req.query(`
    DELETE pv FROM dbo.Provvigioni pv ${join} WHERE ${where}
  `);
  return { count: res.rowsAffected[0] ?? 0 };
}
