import { sql, getPool } from "../db/pool.js";
import type { ConnectorConfig } from "../config.js";

export type IncassoFilter = {
  praticaId?: string;
  praticaIdsIn?: string[];
  userId?: string;
  mandanteId?: string;
  numeroMandante?: string;
  numeriMandanteIn?: string[];
  sedeId?: string;
  dataGte?: string;
  dataLte?: string;
  metodo?: string;
  modo?: string;
  causaleContains?: string;
  fatturaContains?: string;
  cittaContains?: string;
  clienteContains?: string;
  capDa?: string;
  capA?: string;
  dataAffidoGte?: string;
  dataAffidoLte?: string;
  dataScaricoRicevutaGte?: string;
  dataScaricoRicevutaLte?: string;
  none?: boolean;
};

export type IncassoListRequest = {
  tenantId: string;
  filter?: IncassoFilter;
  skip?: number;
  take?: number;
  includePratica?: boolean;
  includeElenco?: boolean;
};

const INCASSO_COLS = `
  i.Id, i.TenantId, i.PraticaId, i.UserId, i.Importo, i.Capitale, i.Interessi,
  i.Spese, i.SpeseRec, i.Metodo, i.Modo, i.Causale, i.Fattura, i.Data, i.DataScadenza, i.CreatedAt
`;

function needsPraticaJoin(filter?: IncassoFilter, includeElenco?: boolean) {
  if (includeElenco) return true;
  if (!filter) return false;
  return Boolean(
    filter.mandanteId ||
      filter.numeroMandante ||
      filter.numeriMandanteIn?.length ||
      filter.sedeId ||
      filter.cittaContains ||
      filter.clienteContains ||
      filter.capDa ||
      filter.capA ||
      filter.dataAffidoGte ||
      filter.dataAffidoLte ||
      filter.dataScaricoRicevutaGte ||
      filter.dataScaricoRicevutaLte
  );
}

function needsDebitoreJoin(filter?: IncassoFilter, includeElenco?: boolean) {
  if (includeElenco) return true;
  if (!filter) return false;
  return Boolean(
    filter.cittaContains || filter.clienteContains || filter.capDa || filter.capA
  );
}

function bindIncassoFilter(
  req: sql.Request,
  tenantId: string,
  filter?: IncassoFilter,
  alias = "i",
  opts?: { includeElenco?: boolean }
): { where: string; join: string } {
  if (filter?.none) {
    return { where: "1 = 0", join: "" };
  }

  req.input("tenantId", sql.UniqueIdentifier, tenantId);
  const clauses = [`${alias}.TenantId = @tenantId`];
  let join = "";

  if (filter?.praticaId) {
    req.input("praticaId", sql.UniqueIdentifier, filter.praticaId);
    clauses.push(`${alias}.PraticaId = @praticaId`);
  }
  if (filter?.praticaIdsIn?.length) {
    filter.praticaIdsIn.forEach((id, idx) =>
      req.input(`pid${idx}`, sql.UniqueIdentifier, id)
    );
    clauses.push(
      `${alias}.PraticaId IN (${filter.praticaIdsIn.map((_, idx) => `@pid${idx}`).join(", ")})`
    );
  }
  if (filter?.userId) {
    req.input("userId", sql.UniqueIdentifier, filter.userId);
    clauses.push(`${alias}.UserId = @userId`);
  }
  if (filter?.dataGte) {
    req.input("dataGte", sql.DateTime2, new Date(filter.dataGte));
    clauses.push(`${alias}.Data >= @dataGte`);
  }
  if (filter?.dataLte) {
    req.input("dataLte", sql.DateTime2, new Date(filter.dataLte));
    clauses.push(`${alias}.Data <= @dataLte`);
  }
  if (filter?.metodo) {
    req.input("metodo", sql.NVarChar(50), filter.metodo);
    clauses.push(`${alias}.Metodo = @metodo`);
  }
  if (filter?.modo) {
    req.input("modo", sql.NVarChar(10), filter.modo.toLowerCase());
    clauses.push(`LOWER(LTRIM(RTRIM(${alias}.Modo))) = @modo`);
  }
  if (filter?.causaleContains) {
    req.input("causaleContains", sql.NVarChar(200), `%${filter.causaleContains}%`);
    clauses.push(`${alias}.Causale LIKE @causaleContains`);
  }
  if (filter?.fatturaContains) {
    req.input("fatturaContains", sql.NVarChar(80), `%${filter.fatturaContains}%`);
    clauses.push(`${alias}.Fattura LIKE @fatturaContains`);
  }

  const joinPratica = needsPraticaJoin(filter, opts?.includeElenco);
  const joinDebitore = needsDebitoreJoin(filter, opts?.includeElenco);

  if (joinPratica) {
    join = ` INNER JOIN dbo.Pratiche p ON p.Id = ${alias}.PraticaId `;
    if (filter?.mandanteId) {
      req.input("mandanteId", sql.UniqueIdentifier, filter.mandanteId);
      clauses.push("p.MandanteId = @mandanteId");
    }
    if (filter?.numeroMandante) {
      req.input("numeroMandante", sql.NVarChar(100), filter.numeroMandante);
      clauses.push("p.NumeroMandante = @numeroMandante");
    }
    if (filter?.numeriMandanteIn?.length) {
      filter.numeriMandanteIn.forEach((n, idx) =>
        req.input(`nm${idx}`, sql.NVarChar(100), n)
      );
      clauses.push(
        `p.NumeroMandante IN (${filter.numeriMandanteIn.map((_, idx) => `@nm${idx}`).join(", ")})`
      );
    }
    if (filter?.dataAffidoGte) {
      req.input("dataAffidoGte", sql.DateTime2, new Date(filter.dataAffidoGte));
      clauses.push("p.DataAffido >= @dataAffidoGte");
    }
    if (filter?.dataAffidoLte) {
      req.input("dataAffidoLte", sql.DateTime2, new Date(filter.dataAffidoLte));
      clauses.push("p.DataAffido <= @dataAffidoLte");
    }
    if (filter?.dataScaricoRicevutaGte) {
      req.input("dataScaricoRicevutaGte", sql.DateTime2, new Date(filter.dataScaricoRicevutaGte));
      clauses.push("p.CodiceScaricoAt >= @dataScaricoRicevutaGte");
    }
    if (filter?.dataScaricoRicevutaLte) {
      req.input("dataScaricoRicevutaLte", sql.DateTime2, new Date(filter.dataScaricoRicevutaLte));
      clauses.push("p.CodiceScaricoAt <= @dataScaricoRicevutaLte");
    }
    if (filter?.sedeId) {
      req.input("sedeId", sql.UniqueIdentifier, filter.sedeId);
      join += `
        LEFT JOIN dbo.Users ua ON ua.Id = p.AssegnatarioId
        LEFT JOIN dbo.Users ut ON ut.Id = p.OperatoreTitolareId
      `;
      clauses.push("(ua.SedeId = @sedeId OR ut.SedeId = @sedeId)");
    }
  }

  if (joinDebitore) {
    if (!joinPratica) {
      join = ` INNER JOIN dbo.Pratiche p ON p.Id = ${alias}.PraticaId `;
    }
    join += ` INNER JOIN dbo.Debitori d ON d.Id = p.DebitoreId `;
    if (filter?.cittaContains) {
      req.input("cittaContains", sql.NVarChar(100), `%${filter.cittaContains}%`);
      clauses.push("d.Citta LIKE @cittaContains");
    }
    if (filter?.clienteContains) {
      req.input("clienteContains", sql.NVarChar(200), `%${filter.clienteContains}%`);
      clauses.push("(d.Nome LIKE @clienteContains OR d.Cognome LIKE @clienteContains OR (d.Cognome + N' ' + d.Nome) LIKE @clienteContains OR (d.Nome + N' ' + d.Cognome) LIKE @clienteContains)");
    }
    if (filter?.capDa) {
      req.input("capDa", sql.NVarChar(10), filter.capDa);
      clauses.push("d.Cap >= @capDa");
    }
    if (filter?.capA) {
      req.input("capA", sql.NVarChar(10), filter.capA);
      clauses.push("d.Cap <= @capA");
    }
  }

  if (opts?.includeElenco) {
    if (!join.includes("dbo.Debitori")) {
      if (!join.includes("dbo.Pratiche")) {
        join = ` INNER JOIN dbo.Pratiche p ON p.Id = ${alias}.PraticaId `;
      }
      join += ` INNER JOIN dbo.Debitori d ON d.Id = p.DebitoreId `;
    }
    join += `
      INNER JOIN dbo.Mandanti m ON m.Id = p.MandanteId
      INNER JOIN dbo.Users u ON u.Id = ${alias}.UserId
    `;
  }

  return { where: clauses.join(" AND "), join };
}

export async function listIncassi(cfg: ConnectorConfig["db"], req: IncassoListRequest) {
  const pool = await getPool(cfg);
  const includeElenco = Boolean(req.includeElenco);
  const baseReq = pool.request();
  const { where, join } = bindIncassoFilter(baseReq, req.tenantId, req.filter, "i", {
    includeElenco,
  });
  const take = req.take ?? 5000;
  const skip = req.skip ?? 0;

  const countReq = pool.request();
  bindIncassoFilter(countReq, req.tenantId, req.filter, "i", { includeElenco });
  const countRes = await countReq.query(`
    SELECT COUNT(*) AS Total FROM dbo.Incassi i ${join} WHERE ${where}
  `);
  const total = Number(countRes.recordset[0]?.Total ?? 0);

  const listReq = pool.request();
  bindIncassoFilter(listReq, req.tenantId, req.filter, "i", { includeElenco });
  listReq.input("skip", sql.Int, skip);
  listReq.input("take", sql.Int, take);

  let select = INCASSO_COLS;
  let praticaJoin = join;

  if (includeElenco) {
    select += `,
      p.Id AS Pratica_Id, p.Numero AS Pratica_Numero, p.NumeroMandante AS Pratica_NumeroMandante,
      p.DataAffido AS Pratica_DataAffido, p.CodiceScaricoAt AS Pratica_CodiceScaricoAt,
      p.MandanteId AS Pratica_MandanteId,
      m.Codice AS Mandante_Codice, m.RagioneSociale AS Mandante_RagioneSociale, m.PerimetriJson AS Mandante_Perimetri,
      d.Nome AS Debitore_Nome, d.Cognome AS Debitore_Cognome, d.Citta AS Debitore_Citta, d.Cap AS Debitore_Cap,
      u.Id AS User_Id, u.Name AS User_Name
    `;
  } else if (req.includePratica) {
    select += `, p.MandanteId AS Pratica_MandanteId`;
    praticaJoin = join || ` INNER JOIN dbo.Pratiche p ON p.Id = i.PraticaId `;
  }

  const result = await listReq.query(`
    SELECT ${select}
    FROM dbo.Incassi i
    ${praticaJoin}
    WHERE ${where}
    ORDER BY i.Data DESC
    OFFSET @skip ROWS FETCH NEXT @take ROWS ONLY
  `);

  const items = result.recordset.map((row: Record<string, unknown>) => {
    if (includeElenco) {
      return {
        Id: row.Id,
        TenantId: row.TenantId,
        PraticaId: row.PraticaId,
        UserId: row.UserId,
        Importo: row.Importo,
        Capitale: row.Capitale,
        Interessi: row.Interessi,
        Spese: row.Spese,
        SpeseRec: row.SpeseRec,
        Metodo: row.Metodo,
        Modo: row.Modo,
        Causale: row.Causale,
        Fattura: row.Fattura,
        Data: row.Data,
        DataScadenza: row.DataScadenza,
        CreatedAt: row.CreatedAt,
        pratica: {
          Id: row.Pratica_Id,
          Numero: row.Pratica_Numero,
          NumeroMandante: row.Pratica_NumeroMandante,
          DataAffido: row.Pratica_DataAffido,
          CodiceScaricoAt: row.Pratica_CodiceScaricoAt,
          MandanteId: row.Pratica_MandanteId,
          mandante: {
            Codice: row.Mandante_Codice,
            RagioneSociale: row.Mandante_RagioneSociale,
            Perimetri: row.Mandante_Perimetri,
          },
          debitore: {
            Nome: row.Debitore_Nome,
            Cognome: row.Debitore_Cognome,
            Citta: row.Debitore_Citta,
            Cap: row.Debitore_Cap,
          },
        },
        user: {
          Id: row.User_Id,
          Name: row.User_Name,
        },
      };
    }
    if (req.includePratica && row.Pratica_MandanteId != null) {
      return {
        ...row,
        pratica: { MandanteId: row.Pratica_MandanteId },
      };
    }
    return row;
  });

  return { items, total };
}

export async function countIncassi(
  cfg: ConnectorConfig["db"],
  tenantId: string,
  filter?: IncassoFilter
) {
  const pool = await getPool(cfg);
  const req = pool.request();
  const { where, join } = bindIncassoFilter(req, tenantId, filter);
  const res = await req.query(`SELECT COUNT(*) AS Total FROM dbo.Incassi i ${join} WHERE ${where}`);
  return Number(res.recordset[0]?.Total ?? 0);
}

export async function aggregateIncassi(
  cfg: ConnectorConfig["db"],
  tenantId: string,
  filter?: IncassoFilter
) {
  const pool = await getPool(cfg);
  const req = pool.request();
  const { where, join } = bindIncassoFilter(req, tenantId, filter);
  const res = await req.query(`
    SELECT
      ISNULL(SUM(i.Importo), 0) AS SumImporto,
      ISNULL(SUM(i.Capitale), 0) AS SumCapitale,
      ISNULL(SUM(i.Interessi), 0) AS SumInteressi,
      ISNULL(SUM(i.Spese), 0) AS SumSpese
    FROM dbo.Incassi i
    ${join}
    WHERE ${where}
  `);
  const row = res.recordset[0] ?? {};
  return {
    _sum: {
      importo: row.SumImporto != null ? Number(row.SumImporto) : null,
      capitale: row.SumCapitale != null ? Number(row.SumCapitale) : null,
      interessi: row.SumInteressi != null ? Number(row.SumInteressi) : null,
      spese: row.SumSpese != null ? Number(row.SumSpese) : null,
    },
  };
}

export async function groupByMetodoIncassi(
  cfg: ConnectorConfig["db"],
  tenantId: string,
  filter?: IncassoFilter
) {
  const pool = await getPool(cfg);
  const req = pool.request();
  const { where, join } = bindIncassoFilter(req, tenantId, filter);
  const res = await req.query(`
    SELECT
      i.Metodo AS metodo,
      ISNULL(SUM(i.Importo), 0) AS sumImporto,
      COUNT(*) AS cnt
    FROM dbo.Incassi i
    ${join}
    WHERE ${where}
    GROUP BY i.Metodo
  `);
  return res.recordset.map((r: { metodo: string; sumImporto: unknown; cnt: number }) => ({
    metodo: r.metodo,
    _sum: { importo: Number(r.sumImporto) },
    _count: Number(r.cnt),
  }));
}

export async function getIncassoById(
  cfg: ConnectorConfig["db"],
  tenantId: string,
  id: string
) {
  const pool = await getPool(cfg);
  const res = await pool
    .request()
    .input("tenantId", sql.UniqueIdentifier, tenantId)
    .input("id", sql.UniqueIdentifier, id)
    .query(`SELECT ${INCASSO_COLS} FROM dbo.Incassi i WHERE i.TenantId = @tenantId AND i.Id = @id`);
  return res.recordset[0] ?? null;
}

export type RegistraIncassoBody = {
  incasso: {
    praticaId: string;
    userId: string;
    importo: number;
    capitale?: number;
    interessi?: number;
    spese?: number;
    speseRec?: number;
    metodo?: string;
    modo?: string;
    causale?: string;
    fattura?: string;
    data?: string;
    dataScadenza?: string | null;
  };
  provvigione?: {
    praticaId: string;
    operatoreId: string;
    baseImporto: number;
    percentuale: number;
    importo: number;
  } | null;
  praticaUpdate: { residuo: number; stato: string };
};

export async function registraIncasso(
  cfg: ConnectorConfig["db"],
  tenantId: string,
  body: RegistraIncassoBody
) {
  const pool = await getPool(cfg);
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    const praticaCheck = await new sql.Request(tx)
      .input("praticaId", sql.UniqueIdentifier, body.incasso.praticaId)
      .input("tenantId", sql.UniqueIdentifier, tenantId)
      .query(`SELECT Id, TenantId FROM dbo.Pratiche WHERE Id = @praticaId AND TenantId = @tenantId`);
    if (!praticaCheck.recordset[0]) {
      throw new Error("Pratica non trovata");
    }

    const inc = body.incasso;
    const incRes = await new sql.Request(tx)
      .input("tenantId", sql.UniqueIdentifier, tenantId)
      .input("praticaId", sql.UniqueIdentifier, inc.praticaId)
      .input("userId", sql.UniqueIdentifier, inc.userId)
      .input("importo", sql.Decimal(18, 2), inc.importo)
      .input("capitale", sql.Decimal(18, 2), inc.capitale ?? 0)
      .input("interessi", sql.Decimal(18, 2), inc.interessi ?? 0)
      .input("spese", sql.Decimal(18, 2), inc.spese ?? 0)
      .input("speseRec", sql.Decimal(18, 2), inc.speseRec ?? 0)
      .input("metodo", sql.NVarChar(30), inc.metodo ?? "bonifico")
      .input("modo", sql.NVarChar(10), inc.modo ?? "VE")
      .input("causale", sql.NVarChar(500), inc.causale ?? "")
      .input("fattura", sql.NVarChar(80), inc.fattura ?? "")
      .input("data", sql.DateTime2, inc.data ? new Date(inc.data) : new Date())
      .input("dataScadenza", sql.DateTime2, inc.dataScadenza ? new Date(inc.dataScadenza) : null)
      .query(`
        INSERT INTO dbo.Incassi (
          TenantId, PraticaId, UserId, Importo, Capitale, Interessi, Spese, SpeseRec,
          Metodo, Modo, Causale, Fattura, Data, DataScadenza
        )
        OUTPUT INSERTED.*
        VALUES (
          @tenantId, @praticaId, @userId, @importo, @capitale, @interessi, @spese, @speseRec,
          @metodo, @modo, @causale, @fattura, @data, @dataScadenza
        )
      `);
    const incassoRow = incRes.recordset[0];
    const incassoId = String(incassoRow.Id);

    if (body.provvigione) {
      const prov = body.provvigione;
      await new sql.Request(tx)
        .input("tenantId", sql.UniqueIdentifier, tenantId)
        .input("incassoId", sql.UniqueIdentifier, incassoId)
        .input("praticaId", sql.UniqueIdentifier, prov.praticaId)
        .input("operatoreId", sql.UniqueIdentifier, prov.operatoreId)
        .input("baseImporto", sql.Decimal(18, 2), prov.baseImporto)
        .input("percentuale", sql.Decimal(8, 4), prov.percentuale)
        .input("importo", sql.Decimal(18, 2), prov.importo)
        .query(`
          INSERT INTO dbo.Provvigioni (
            TenantId, IncassoId, PraticaId, OperatoreId, BaseImporto, Percentuale, Importo
          )
          VALUES (@tenantId, @incassoId, @praticaId, @operatoreId, @baseImporto, @percentuale, @importo)
        `);
    }

    await new sql.Request(tx)
      .input("praticaId", sql.UniqueIdentifier, inc.praticaId)
      .input("residuo", sql.Decimal(18, 2), body.praticaUpdate.residuo)
      .input("stato", sql.NVarChar(30), body.praticaUpdate.stato)
      .query(`
        UPDATE dbo.Pratiche SET
          Residuo = @residuo,
          Stato = @stato,
          TotIncassato = (
            SELECT ISNULL(SUM(Importo), 0) FROM dbo.Incassi WHERE PraticaId = @praticaId
          ),
          UpdatedAt = SYSUTCDATETIME()
        WHERE Id = @praticaId
      `);

    await tx.commit();
    return incassoRow;
  } catch (err) {
    await tx.rollback();
    throw err;
  }
}

export type AggiornaIncassoBody = {
  incasso: {
    importo: number;
    capitale?: number;
    interessi?: number;
    spese?: number;
    speseRec?: number;
    metodo?: string;
    modo?: string;
    causale?: string;
    fattura?: string;
    data?: string;
    dataScadenza?: string | null;
  };
  provvigione?: {
    praticaId: string;
    operatoreId: string;
    baseImporto: number;
    percentuale: number;
    importo: number;
  } | null;
  praticaUpdate: { residuo: number; stato: string };
};

export async function aggiornaIncasso(
  cfg: ConnectorConfig["db"],
  tenantId: string,
  incassoId: string,
  body: AggiornaIncassoBody
) {
  const pool = await getPool(cfg);
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    const existing = await new sql.Request(tx)
      .input("id", sql.UniqueIdentifier, incassoId)
      .input("tenantId", sql.UniqueIdentifier, tenantId)
      .query(`
        SELECT Id, PraticaId FROM dbo.Incassi
        WHERE Id = @id AND TenantId = @tenantId
      `);
    const row = existing.recordset[0];
    if (!row) throw new Error("Incasso non trovato");

    const inc = body.incasso;
    const upd = await new sql.Request(tx)
      .input("id", sql.UniqueIdentifier, incassoId)
      .input("importo", sql.Decimal(18, 2), inc.importo)
      .input("capitale", sql.Decimal(18, 2), inc.capitale ?? 0)
      .input("interessi", sql.Decimal(18, 2), inc.interessi ?? 0)
      .input("spese", sql.Decimal(18, 2), inc.spese ?? 0)
      .input("speseRec", sql.Decimal(18, 2), inc.speseRec ?? 0)
      .input("metodo", sql.NVarChar(30), inc.metodo ?? "bonifico")
      .input("modo", sql.NVarChar(10), inc.modo ?? "ve")
      .input("causale", sql.NVarChar(500), inc.causale ?? "")
      .input("fattura", sql.NVarChar(80), inc.fattura ?? "")
      .input("data", sql.DateTime2, inc.data ? new Date(inc.data) : new Date())
      .input("dataScadenza", sql.DateTime2, inc.dataScadenza ? new Date(inc.dataScadenza) : null)
      .query(`
        UPDATE dbo.Incassi SET
          Importo = @importo,
          Capitale = @capitale,
          Interessi = @interessi,
          Spese = @spese,
          SpeseRec = @speseRec,
          Metodo = @metodo,
          Modo = @modo,
          Causale = @causale,
          Fattura = @fattura,
          Data = @data,
          DataScadenza = @dataScadenza
        OUTPUT INSERTED.*
        WHERE Id = @id
      `);

    await new sql.Request(tx)
      .input("incassoId", sql.UniqueIdentifier, incassoId)
      .query(`DELETE FROM dbo.Provvigioni WHERE IncassoId = @incassoId`);

    if (body.provvigione) {
      const prov = body.provvigione;
      await new sql.Request(tx)
        .input("tenantId", sql.UniqueIdentifier, tenantId)
        .input("incassoId", sql.UniqueIdentifier, incassoId)
        .input("praticaId", sql.UniqueIdentifier, prov.praticaId)
        .input("operatoreId", sql.UniqueIdentifier, prov.operatoreId)
        .input("baseImporto", sql.Decimal(18, 2), prov.baseImporto)
        .input("percentuale", sql.Decimal(8, 4), prov.percentuale)
        .input("importo", sql.Decimal(18, 2), prov.importo)
        .query(`
          INSERT INTO dbo.Provvigioni (
            TenantId, IncassoId, PraticaId, OperatoreId, BaseImporto, Percentuale, Importo
          )
          VALUES (@tenantId, @incassoId, @praticaId, @operatoreId, @baseImporto, @percentuale, @importo)
        `);
    }

    await new sql.Request(tx)
      .input("praticaId", sql.UniqueIdentifier, String(row.PraticaId))
      .input("residuo", sql.Decimal(18, 2), body.praticaUpdate.residuo)
      .input("stato", sql.NVarChar(30), body.praticaUpdate.stato)
      .query(`
        UPDATE dbo.Pratiche SET
          Residuo = @residuo,
          Stato = @stato,
          TotIncassato = (
            SELECT ISNULL(SUM(Importo), 0) FROM dbo.Incassi WHERE PraticaId = @praticaId
          ),
          UpdatedAt = SYSUTCDATETIME()
        WHERE Id = @praticaId
      `);

    await tx.commit();
    return upd.recordset[0];
  } catch (err) {
    await tx.rollback();
    throw err;
  }
}

export async function eliminaIncasso(
  cfg: ConnectorConfig["db"],
  tenantId: string,
  incassoId: string,
  praticaUpdate: { residuo: number; stato: string }
) {
  const pool = await getPool(cfg);
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    const existing = await new sql.Request(tx)
      .input("id", sql.UniqueIdentifier, incassoId)
      .input("tenantId", sql.UniqueIdentifier, tenantId)
      .query(`
        SELECT Id, PraticaId FROM dbo.Incassi
        WHERE Id = @id AND TenantId = @tenantId
      `);
    const row = existing.recordset[0];
    if (!row) throw new Error("Incasso non trovato");

    await new sql.Request(tx)
      .input("incassoId", sql.UniqueIdentifier, incassoId)
      .query(`DELETE FROM dbo.Provvigioni WHERE IncassoId = @incassoId`);

    await new sql.Request(tx)
      .input("id", sql.UniqueIdentifier, incassoId)
      .query(`DELETE FROM dbo.Incassi WHERE Id = @id`);

    await new sql.Request(tx)
      .input("praticaId", sql.UniqueIdentifier, String(row.PraticaId))
      .input("residuo", sql.Decimal(18, 2), praticaUpdate.residuo)
      .input("stato", sql.NVarChar(30), praticaUpdate.stato)
      .query(`
        UPDATE dbo.Pratiche SET
          Residuo = @residuo,
          Stato = @stato,
          TotIncassato = (
            SELECT ISNULL(SUM(Importo), 0) FROM dbo.Incassi WHERE PraticaId = @praticaId
          ),
          UpdatedAt = SYSUTCDATETIME()
        WHERE Id = @praticaId
      `);

    await tx.commit();
    return { ok: true };
  } catch (err) {
    await tx.rollback();
    throw err;
  }
}
