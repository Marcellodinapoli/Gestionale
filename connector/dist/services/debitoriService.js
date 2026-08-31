import { sql, getPool } from "../db/pool.js";
const DEBITORE_COLS = `
  d.Id, d.TenantId, d.Nome, d.Cognome, d.CodiceFiscale, d.Telefono, d.TelefonoStato,
  d.Email, d.Indirizzo, d.Citta, d.Cap, d.Provincia, d.Ndg, d.CreatedAt
`;
function mapDebitoreToSql(data) {
    const out = {};
    const fieldMap = {
        tenantId: "TenantId",
        nome: "Nome",
        cognome: "Cognome",
        codiceFiscale: "CodiceFiscale",
        telefono: "Telefono",
        telefonoStato: "TelefonoStato",
        email: "Email",
        indirizzo: "Indirizzo",
        citta: "Citta",
        cap: "Cap",
        provincia: "Provincia",
        ndg: "Ndg",
    };
    for (const [k, v] of Object.entries(data)) {
        if (v === undefined)
            continue;
        out[fieldMap[k] ?? k] = v;
    }
    return out;
}
function bindDebitoreFilter(req, tenantId, filter) {
    req.input("tenantId", sql.UniqueIdentifier, tenantId);
    const clauses = ["d.TenantId = @tenantId"];
    if (filter?.ids?.length === 1) {
        req.input("id0", sql.UniqueIdentifier, filter.ids[0]);
        clauses.push("d.Id = @id0");
    }
    else if (filter?.idsIn?.length) {
        filter.idsIn.forEach((id, i) => req.input(`id${i}`, sql.UniqueIdentifier, id));
        clauses.push(`d.Id IN (${filter.idsIn.map((_, i) => `@id${i}`).join(", ")})`);
    }
    else if (filter?.ids?.length) {
        filter.ids.forEach((id, i) => req.input(`id${i}`, sql.UniqueIdentifier, id));
        clauses.push(`d.Id IN (${filter.ids.map((_, i) => `@id${i}`).join(", ")})`);
    }
    if (filter?.codiceFiscaleIn?.length) {
        filter.codiceFiscaleIn.forEach((cf, i) => req.input(`cf${i}`, sql.NVarChar(20), cf));
        clauses.push(`d.CodiceFiscale IN (${filter.codiceFiscaleIn.map((_, i) => `@cf${i}`).join(", ")})`);
    }
    if (filter?.q) {
        req.input("q", sql.NVarChar(200), `%${filter.q}%`);
        clauses.push("(d.Nome LIKE @q OR d.Cognome LIKE @q OR d.CodiceFiscale LIKE @q)");
    }
    return clauses.join(" AND ");
}
export async function listDebitori(cfg, req) {
    const pool = await getPool(cfg);
    const where = bindDebitoreFilter(pool.request(), req.tenantId, req.filter);
    const take = req.take ?? 500;
    const skip = req.skip ?? 0;
    const countReq = pool.request();
    bindDebitoreFilter(countReq, req.tenantId, req.filter);
    const countRes = await countReq.query(`SELECT COUNT(*) AS Total FROM dbo.Debitori d WHERE ${where}`);
    const total = Number(countRes.recordset[0]?.Total ?? 0);
    const listReq = pool.request();
    bindDebitoreFilter(listReq, req.tenantId, req.filter);
    listReq.input("skip", sql.Int, skip);
    listReq.input("take", sql.Int, take);
    const result = await listReq.query(`
    SELECT ${DEBITORE_COLS}
    FROM dbo.Debitori d
    WHERE ${where}
    ORDER BY d.Cognome, d.Nome
    OFFSET @skip ROWS FETCH NEXT @take ROWS ONLY
  `);
    return { items: result.recordset, total };
}
export async function idsByCodiceFiscale(cfg, tenantId, variants) {
    if (!variants.length)
        return [];
    const pool = await getPool(cfg);
    const req = pool.request();
    req.input("tenantId", sql.UniqueIdentifier, tenantId);
    variants.forEach((v, i) => req.input(`cf${i}`, sql.NVarChar(20), v));
    const result = await req.query(`
    SELECT Id, CodiceFiscale FROM dbo.Debitori d
    WHERE d.TenantId = @tenantId
      AND d.CodiceFiscale IN (${variants.map((_, i) => `@cf${i}`).join(", ")})
  `);
    return result.recordset;
}
export async function getDebitoreById(cfg, tenantId, id) {
    const pool = await getPool(cfg);
    const result = await pool
        .request()
        .input("tenantId", sql.UniqueIdentifier, tenantId)
        .input("id", sql.UniqueIdentifier, id)
        .query(`
      SELECT ${DEBITORE_COLS} FROM dbo.Debitori d
      WHERE d.TenantId = @tenantId AND d.Id = @id
    `);
    return result.recordset[0] ?? null;
}
export async function createDebitore(cfg, tenantId, data) {
    const pool = await getPool(cfg);
    const mapped = mapDebitoreToSql(data);
    mapped.TenantId = tenantId;
    const cols = Object.keys(mapped);
    const req = pool.request();
    cols.forEach((c, i) => {
        const val = mapped[c];
        if (c.endsWith("Id"))
            req.input(`p${i}`, sql.UniqueIdentifier, val);
        else
            req.input(`p${i}`, sql.NVarChar(500), val == null ? null : String(val));
    });
    const result = await req.query(`
    INSERT INTO dbo.Debitori (${cols.join(", ")})
    OUTPUT INSERTED.*
    VALUES (${cols.map((_, i) => `@p${i}`).join(", ")})
  `);
    return result.recordset[0];
}
export async function updateDebitore(cfg, tenantId, id, data) {
    const pool = await getPool(cfg);
    const mapped = mapDebitoreToSql(data);
    const sets = [];
    const req = pool.request();
    req.input("tenantId", sql.UniqueIdentifier, tenantId);
    req.input("id", sql.UniqueIdentifier, id);
    let i = 0;
    for (const [col, val] of Object.entries(mapped)) {
        if (col === "TenantId" || col === "Id")
            continue;
        req.input(`u${i}`, sql.NVarChar(500), val == null ? null : String(val));
        sets.push(`${col} = @u${i}`);
        i++;
    }
    if (!sets.length)
        return getDebitoreById(cfg, tenantId, id);
    const result = await req.query(`
    UPDATE dbo.Debitori SET ${sets.join(", ")}
    OUTPUT INSERTED.*
    WHERE Id = @id AND TenantId = @tenantId
  `);
    return result.recordset[0] ?? null;
}
export async function deleteDebitore(cfg, tenantId, id) {
    await getPool(cfg).then((pool) => pool
        .request()
        .input("tenantId", sql.UniqueIdentifier, tenantId)
        .input("id", sql.UniqueIdentifier, id)
        .query(`DELETE FROM dbo.Debitori WHERE Id = @id AND TenantId = @tenantId`));
}
export async function listRecapiti(cfg, debitoreId) {
    const pool = await getPool(cfg);
    const result = await pool
        .request()
        .input("debitoreId", sql.UniqueIdentifier, debitoreId)
        .query(`
      SELECT * FROM dbo.DebitoreRecapiti
      WHERE DebitoreId = @debitoreId
      ORDER BY Tipo, Ordine
    `);
    return result.recordset;
}
export async function countRecapiti(cfg, debitoreId, tipo) {
    const pool = await getPool(cfg);
    const req = pool.request().input("debitoreId", sql.UniqueIdentifier, debitoreId);
    let where = "DebitoreId = @debitoreId";
    if (tipo) {
        req.input("tipo", sql.NVarChar(30), tipo);
        where += " AND Tipo = @tipo";
    }
    const result = await req.query(`SELECT COUNT(*) AS C FROM dbo.DebitoreRecapiti WHERE ${where}`);
    return Number(result.recordset[0]?.C ?? 0);
}
export async function findFirstRecapito(cfg, filter) {
    const pool = await getPool(cfg);
    const req = pool.request();
    const clauses = [];
    if (filter.id) {
        req.input("id", sql.UniqueIdentifier, filter.id);
        clauses.push("Id = @id");
    }
    if (filter.debitoreId) {
        req.input("debitoreId", sql.UniqueIdentifier, filter.debitoreId);
        clauses.push("DebitoreId = @debitoreId");
    }
    if (filter.tipo) {
        req.input("tipo", sql.NVarChar(30), filter.tipo);
        clauses.push("Tipo = @tipo");
    }
    if (!clauses.length)
        return null;
    const result = await req.query(`
    SELECT TOP 1 * FROM dbo.DebitoreRecapiti WHERE ${clauses.join(" AND ")}
  `);
    return result.recordset[0] ?? null;
}
export async function createRecapito(cfg, data) {
    const pool = await getPool(cfg);
    const result = await pool
        .request()
        .input("debitoreId", sql.UniqueIdentifier, data.debitoreId)
        .input("tipo", sql.NVarChar(30), data.tipo)
        .input("valore", sql.NVarChar(200), data.valore)
        .input("ordine", sql.Int, data.ordine ?? 1)
        .input("stato", sql.NVarChar(30), data.stato ?? null)
        .query(`
      INSERT INTO dbo.DebitoreRecapiti (DebitoreId, Tipo, Valore, Ordine, Stato)
      OUTPUT INSERTED.*
      VALUES (@debitoreId, @tipo, @valore, @ordine, @stato)
    `);
    return result.recordset[0];
}
export async function updateRecapito(cfg, id, data) {
    const pool = await getPool(cfg);
    const req = pool.request().input("id", sql.UniqueIdentifier, id);
    const sets = [];
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
    if (!sets.length)
        return findFirstRecapito(cfg, { id });
    const result = await req.query(`
    UPDATE dbo.DebitoreRecapiti SET ${sets.join(", ")} OUTPUT INSERTED.* WHERE Id = @id
  `);
    return result.recordset[0] ?? null;
}
export async function deleteRecapito(cfg, id) {
    await getPool(cfg).then((pool) => pool.request().input("id", sql.UniqueIdentifier, id).query(`DELETE FROM dbo.DebitoreRecapiti WHERE Id = @id`));
}
export async function deleteRecapitiByDebitore(cfg, debitoreId) {
    await getPool(cfg).then((pool) => pool
        .request()
        .input("debitoreId", sql.UniqueIdentifier, debitoreId)
        .query(`DELETE FROM dbo.DebitoreRecapiti WHERE DebitoreId = @debitoreId`));
}
