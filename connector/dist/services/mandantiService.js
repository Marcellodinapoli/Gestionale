import { sql, getPool } from "../db/pool.js";
const MANDANTE_COLS = `
  m.Id, m.TenantId, m.Codice, m.RagioneSociale, m.Email, m.Telefono,
  m.Referente, m.ReferenteTelefono, m.ReferenteEmail, m.Pec,
  m.Indirizzo, m.Citta, m.Cap, m.Provincia,
  m.ProvvigionePerc, m.ProvvigioniMetodoJson, m.IncentivoTipo,
  m.IncentivoValore, m.IncentivoSoglia, m.IncentivoNote,
  m.CodiciScaricoJson, m.SmsPreimpostatiJson, m.PerimetriJson AS Perimetri,
  m.CreatedAt
`;
function mapPrismaToSql(data) {
    const out = {};
    const fieldMap = {
        tenantId: "TenantId",
        codice: "Codice",
        ragioneSociale: "RagioneSociale",
        email: "Email",
        telefono: "Telefono",
        referente: "Referente",
        referenteTelefono: "ReferenteTelefono",
        referenteEmail: "ReferenteEmail",
        pec: "Pec",
        indirizzo: "Indirizzo",
        citta: "Citta",
        cap: "Cap",
        provincia: "Provincia",
        provvigionePerc: "ProvvigionePerc",
        provvigioniMetodo: "ProvvigioniMetodoJson",
        incentivoTipo: "IncentivoTipo",
        incentivoValore: "IncentivoValore",
        incentivoSoglia: "IncentivoSoglia",
        incentivoNote: "IncentivoNote",
        codiciScarico: "CodiciScaricoJson",
        smsPreimpostati: "SmsPreimpostatiJson",
        perimetri: "PerimetriJson",
    };
    for (const [k, v] of Object.entries(data)) {
        if (v === undefined)
            continue;
        const col = fieldMap[k] ?? k;
        out[col] = v;
    }
    return out;
}
function bindFilter(req, tenantId, filter) {
    req.input("tenantId", sql.UniqueIdentifier, tenantId);
    const clauses = ["m.TenantId = @tenantId"];
    if (filter?.ids?.length === 1) {
        req.input("id0", sql.UniqueIdentifier, filter.ids[0]);
        clauses.push("m.Id = @id0");
    }
    else if (filter?.idsIn?.length) {
        filter.idsIn.forEach((id, i) => req.input(`id${i}`, sql.UniqueIdentifier, id));
        clauses.push(`m.Id IN (${filter.idsIn.map((_, i) => `@id${i}`).join(", ")})`);
    }
    else if (filter?.ids?.length) {
        filter.ids.forEach((id, i) => req.input(`id${i}`, sql.UniqueIdentifier, id));
        clauses.push(`m.Id IN (${filter.ids.map((_, i) => `@id${i}`).join(", ")})`);
    }
    if (filter?.codice) {
        req.input("codice", sql.NVarChar(50), filter.codice);
        clauses.push("m.Codice = @codice");
    }
    if (filter?.q) {
        req.input("q", sql.NVarChar(200), `%${filter.q}%`);
        clauses.push("(m.Codice LIKE @q OR m.RagioneSociale LIKE @q)");
    }
    return clauses.join(" AND ");
}
export async function listMandanti(cfg, req) {
    const pool = await getPool(cfg);
    const where = bindFilter(pool.request(), req.tenantId, req.filter);
    const orderCol = req.orderBy === "ragioneSociale" ? "m.RagioneSociale" : "m.Codice";
    const orderDir = req.orderDir === "desc" ? "DESC" : "ASC";
    const pageSize = req.take ?? 500;
    const skip = req.skip ?? 0;
    const countReq = pool.request();
    bindFilter(countReq, req.tenantId, req.filter);
    const countRes = await countReq.query(`
    SELECT COUNT(*) AS Total FROM dbo.Mandanti m WHERE ${where}
  `);
    const total = Number(countRes.recordset[0]?.Total ?? 0);
    const listReq = pool.request();
    bindFilter(listReq, req.tenantId, req.filter);
    listReq.input("skip", sql.Int, skip);
    listReq.input("take", sql.Int, pageSize);
    const countJoin = req.includePraticaCount
        ? `, (SELECT COUNT(*) FROM dbo.Pratiche p WHERE p.MandanteId = m.Id AND p.TenantId = m.TenantId) AS PraticaCount`
        : "";
    const result = await listReq.query(`
    SELECT ${MANDANTE_COLS}${countJoin}
    FROM dbo.Mandanti m
    WHERE ${where}
    ORDER BY ${orderCol} ${orderDir}
    OFFSET @skip ROWS FETCH NEXT @take ROWS ONLY
  `);
    return { items: result.recordset, total, page: Math.floor(skip / pageSize) + 1, pageSize };
}
export async function countMandanti(cfg, tenantId, filter) {
    const pool = await getPool(cfg);
    const req = pool.request();
    const where = bindFilter(req, tenantId, filter);
    const result = await req.query(`SELECT COUNT(*) AS Total FROM dbo.Mandanti m WHERE ${where}`);
    return Number(result.recordset[0]?.Total ?? 0);
}
export async function getMandanteById(cfg, tenantId, id, includePraticaCount = false) {
    const pool = await getPool(cfg);
    const countJoin = includePraticaCount
        ? `, (SELECT COUNT(*) FROM dbo.Pratiche p WHERE p.MandanteId = m.Id AND p.TenantId = m.TenantId) AS PraticaCount`
        : "";
    const result = await pool
        .request()
        .input("tenantId", sql.UniqueIdentifier, tenantId)
        .input("id", sql.UniqueIdentifier, id)
        .query(`
      SELECT ${MANDANTE_COLS}${countJoin}
      FROM dbo.Mandanti m
      WHERE m.TenantId = @tenantId AND m.Id = @id
    `);
    return result.recordset[0] ?? null;
}
export async function createMandante(cfg, tenantId, data) {
    const pool = await getPool(cfg);
    const mapped = mapPrismaToSql(data);
    mapped.TenantId = tenantId;
    const cols = Object.keys(mapped);
    const req = pool.request();
    cols.forEach((c, i) => {
        const val = mapped[c];
        if (c.endsWith("Id") || c === "TenantId")
            req.input(`p${i}`, sql.UniqueIdentifier, val);
        else if (typeof val === "number")
            req.input(`p${i}`, sql.Float, val);
        else
            req.input(`p${i}`, sql.NVarChar(sql.MAX), val == null ? null : String(val));
    });
    const result = await req.query(`
    INSERT INTO dbo.Mandanti (${cols.join(", ")})
    OUTPUT INSERTED.*
    VALUES (${cols.map((_, i) => `@p${i}`).join(", ")})
  `);
    const row = result.recordset[0];
    if (row)
        row.Perimetri = row.PerimetriJson ?? row.Perimetri;
    return row;
}
export async function updateMandante(cfg, tenantId, id, data) {
    const pool = await getPool(cfg);
    const mapped = mapPrismaToSql(data);
    const sets = [];
    const req = pool.request();
    req.input("tenantId", sql.UniqueIdentifier, tenantId);
    req.input("id", sql.UniqueIdentifier, id);
    let i = 0;
    for (const [col, val] of Object.entries(mapped)) {
        if (col === "TenantId" || col === "Id")
            continue;
        req.input(`u${i}`, col.endsWith("Json") || col === "PerimetriJson" ? sql.NVarChar(sql.MAX) : typeof val === "number" ? sql.Float : sql.NVarChar(500), val);
        sets.push(`${col} = @u${i}`);
        i++;
    }
    if (!sets.length)
        return getMandanteById(cfg, tenantId, id);
    const result = await req.query(`
    UPDATE dbo.Mandanti SET ${sets.join(", ")}
    OUTPUT INSERTED.*
    WHERE Id = @id AND TenantId = @tenantId
  `);
    const row = result.recordset[0];
    if (row)
        row.Perimetri = row.PerimetriJson ?? row.Perimetri;
    return row ?? null;
}
export async function deleteMandante(cfg, tenantId, id) {
    const pool = await getPool(cfg);
    const countRes = await pool
        .request()
        .input("tenantId", sql.UniqueIdentifier, tenantId)
        .input("id", sql.UniqueIdentifier, id)
        .query(`
      SELECT COUNT(*) AS C FROM dbo.Pratiche WHERE MandanteId = @id AND TenantId = @tenantId
    `);
    const linked = Number(countRes.recordset[0]?.C ?? 0);
    if (linked > 0) {
        const err = new Error(`Impossibile eliminare: ${linked} pratiche collegate`);
        err.statusCode = 409;
        throw err;
    }
    await pool
        .request()
        .input("tenantId", sql.UniqueIdentifier, tenantId)
        .input("id", sql.UniqueIdentifier, id)
        .query(`DELETE FROM dbo.Mandanti WHERE Id = @id AND TenantId = @tenantId`);
}
