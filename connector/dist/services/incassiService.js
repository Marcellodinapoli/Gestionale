import { sql, getPool } from "../db/pool.js";
const INCASSO_COLS = `
  i.Id, i.TenantId, i.PraticaId, i.UserId, i.Importo, i.Capitale, i.Interessi,
  i.Spese, i.SpeseRec, i.Metodo, i.Modo, i.Causale, i.Data, i.DataScadenza, i.CreatedAt
`;
function bindIncassoFilter(req, tenantId, filter, alias = "i") {
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
        filter.praticaIdsIn.forEach((id, idx) => req.input(`pid${idx}`, sql.UniqueIdentifier, id));
        clauses.push(`${alias}.PraticaId IN (${filter.praticaIdsIn.map((_, idx) => `@pid${idx}`).join(", ")})`);
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
    const needsPraticaJoin = filter?.mandanteId || filter?.numeroMandante || filter?.sedeId;
    if (needsPraticaJoin) {
        join = ` INNER JOIN dbo.Pratiche p ON p.Id = ${alias}.PraticaId `;
        if (filter?.mandanteId) {
            req.input("mandanteId", sql.UniqueIdentifier, filter.mandanteId);
            clauses.push("p.MandanteId = @mandanteId");
        }
        if (filter?.numeroMandante) {
            req.input("numeroMandante", sql.NVarChar(100), filter.numeroMandante);
            clauses.push("p.NumeroMandante = @numeroMandante");
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
    return { where: clauses.join(" AND "), join };
}
export async function listIncassi(cfg, req) {
    const pool = await getPool(cfg);
    const baseReq = pool.request();
    const { where, join } = bindIncassoFilter(baseReq, req.tenantId, req.filter);
    const take = req.take ?? 5000;
    const skip = req.skip ?? 0;
    const countReq = pool.request();
    bindIncassoFilter(countReq, req.tenantId, req.filter);
    const countRes = await countReq.query(`
    SELECT COUNT(*) AS Total FROM dbo.Incassi i ${join} WHERE ${where}
  `);
    const total = Number(countRes.recordset[0]?.Total ?? 0);
    const listReq = pool.request();
    bindIncassoFilter(listReq, req.tenantId, req.filter);
    listReq.input("skip", sql.Int, skip);
    listReq.input("take", sql.Int, take);
    let select = INCASSO_COLS;
    if (req.includePratica) {
        select += `, p.MandanteId AS Pratica_MandanteId`;
    }
    const praticaJoin = req.includePratica
        ? join || ` INNER JOIN dbo.Pratiche p ON p.Id = i.PraticaId `
        : join;
    const result = await listReq.query(`
    SELECT ${select}
    FROM dbo.Incassi i
    ${praticaJoin}
    WHERE ${where}
    ORDER BY i.Data DESC
    OFFSET @skip ROWS FETCH NEXT @take ROWS ONLY
  `);
    const items = result.recordset.map((row) => {
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
export async function countIncassi(cfg, tenantId, filter) {
    const pool = await getPool(cfg);
    const req = pool.request();
    const { where, join } = bindIncassoFilter(req, tenantId, filter);
    const res = await req.query(`SELECT COUNT(*) AS Total FROM dbo.Incassi i ${join} WHERE ${where}`);
    return Number(res.recordset[0]?.Total ?? 0);
}
export async function aggregateIncassi(cfg, tenantId, filter) {
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
export async function groupByMetodoIncassi(cfg, tenantId, filter) {
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
    return res.recordset.map((r) => ({
        metodo: r.metodo,
        _sum: { importo: Number(r.sumImporto) },
        _count: Number(r.cnt),
    }));
}
export async function getIncassoById(cfg, tenantId, id) {
    const pool = await getPool(cfg);
    const res = await pool
        .request()
        .input("tenantId", sql.UniqueIdentifier, tenantId)
        .input("id", sql.UniqueIdentifier, id)
        .query(`SELECT ${INCASSO_COLS} FROM dbo.Incassi i WHERE i.TenantId = @tenantId AND i.Id = @id`);
    return res.recordset[0] ?? null;
}
export async function registraIncasso(cfg, tenantId, body) {
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
            .input("data", sql.DateTime2, inc.data ? new Date(inc.data) : new Date())
            .input("dataScadenza", sql.DateTime2, inc.dataScadenza ? new Date(inc.dataScadenza) : null)
            .query(`
        INSERT INTO dbo.Incassi (
          TenantId, PraticaId, UserId, Importo, Capitale, Interessi, Spese, SpeseRec,
          Metodo, Modo, Causale, Data, DataScadenza
        )
        OUTPUT INSERTED.*
        VALUES (
          @tenantId, @praticaId, @userId, @importo, @capitale, @interessi, @spese, @speseRec,
          @metodo, @modo, @causale, @data, @dataScadenza
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
        UPDATE dbo.Pratiche SET Residuo = @residuo, Stato = @stato, UpdatedAt = SYSUTCDATETIME()
        WHERE Id = @praticaId
      `);
        await tx.commit();
        return incassoRow;
    }
    catch (err) {
        await tx.rollback();
        throw err;
    }
}
