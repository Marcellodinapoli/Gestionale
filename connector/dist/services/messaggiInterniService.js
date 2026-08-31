import { sql, getPool } from "../db/pool.js";
function mapRow(r) {
    const row = {
        id: String(r.Id),
        praticaId: r.PraticaId != null ? String(r.PraticaId) : null,
        fromUserId: String(r.FromUserId),
        toUserId: String(r.ToUserId),
        testo: String(r.Testo),
        letto: Boolean(r.Letto),
        lettoAt: r.LettoAt ? new Date(String(r.LettoAt)).toISOString() : null,
        createdAt: new Date(String(r.CreatedAt)).toISOString(),
        fromUser: { id: String(r.FromUserId), name: String(r.FromName) },
        toUser: { id: String(r.ToUserId), name: String(r.ToName) },
    };
    if (r.Numero != null) {
        row.pratica = {
            id: String(r.PraticaId),
            numero: String(r.Numero),
            debitore: {
                nome: String(r.DebitoreNome ?? ""),
                cognome: String(r.DebitoreCognome ?? ""),
            },
        };
    }
    return row;
}
export async function listMessaggiInterni(cfg, tenantId, filter, take = 100) {
    const pool = await getPool(cfg);
    const req = pool.request();
    req.input("tenantId", sql.UniqueIdentifier, tenantId);
    req.input("take", sql.Int, take);
    const clauses = ["m.TenantId = @tenantId"];
    if (filter?.toUserId) {
        req.input("toUserId", sql.UniqueIdentifier, filter.toUserId);
        clauses.push("m.ToUserId = @toUserId");
    }
    if (filter?.fromUserId) {
        req.input("fromUserId", sql.UniqueIdentifier, filter.fromUserId);
        clauses.push("m.FromUserId = @fromUserId");
    }
    if (filter?.userId) {
        req.input("userId", sql.UniqueIdentifier, filter.userId);
        clauses.push("(m.ToUserId = @userId OR m.FromUserId = @userId)");
    }
    if (filter?.letto === false)
        clauses.push("m.Letto = 0");
    const res = await req.query(`
    SELECT TOP (@take) m.*,
      fu.Name AS FromName, tu.Name AS ToName,
      p.Numero, d.Nome AS DebitoreNome, d.Cognome AS DebitoreCognome
    FROM dbo.MessaggiInterni m
    INNER JOIN dbo.Users fu ON fu.Id = m.FromUserId
    INNER JOIN dbo.Users tu ON tu.Id = m.ToUserId
    LEFT JOIN dbo.Pratiche p ON p.Id = m.PraticaId
    LEFT JOIN dbo.Debitori d ON d.Id = p.DebitoreId
    WHERE ${clauses.join(" AND ")}
    ORDER BY m.CreatedAt DESC
  `);
    return res.recordset.map((r) => mapRow(r));
}
export async function createMessaggiInterni(cfg, tenantId, items) {
    if (!items.length)
        return;
    const pool = await getPool(cfg);
    for (const item of items) {
        const req = pool.request();
        req.input("tenantId", sql.UniqueIdentifier, tenantId);
        req.input("fromUserId", sql.UniqueIdentifier, item.fromUserId);
        req.input("toUserId", sql.UniqueIdentifier, item.toUserId);
        req.input("testo", sql.NVarChar(sql.MAX), item.testo);
        if (item.praticaId)
            req.input("praticaId", sql.UniqueIdentifier, item.praticaId);
        await req.query(`
      INSERT INTO dbo.MessaggiInterni (TenantId, FromUserId, ToUserId, PraticaId, Testo, Letto, CreatedAt)
      VALUES (@tenantId, @fromUserId, @toUserId, ${item.praticaId ? "@praticaId" : "NULL"}, @testo, 0, SYSUTCDATETIME())
    `);
    }
}
export async function getMessaggioInternoById(cfg, tenantId, id) {
    const pool = await getPool(cfg);
    const res = await pool
        .request()
        .input("tenantId", sql.UniqueIdentifier, tenantId)
        .input("id", sql.UniqueIdentifier, id)
        .query(`
      SELECT m.*, fu.Name AS FromName, tu.Name AS ToName,
        p.Numero, d.Nome AS DebitoreNome, d.Cognome AS DebitoreCognome
      FROM dbo.MessaggiInterni m
      INNER JOIN dbo.Users fu ON fu.Id = m.FromUserId
      INNER JOIN dbo.Users tu ON tu.Id = m.ToUserId
      LEFT JOIN dbo.Pratiche p ON p.Id = m.PraticaId
      LEFT JOIN dbo.Debitori d ON d.Id = p.DebitoreId
      WHERE m.TenantId = @tenantId AND m.Id = @id
    `);
    const row = res.recordset[0];
    return row ? mapRow(row) : null;
}
export async function updateMessaggioInternoLetto(cfg, tenantId, id, letto) {
    const pool = await getPool(cfg);
    await pool
        .request()
        .input("tenantId", sql.UniqueIdentifier, tenantId)
        .input("id", sql.UniqueIdentifier, id)
        .input("letto", sql.Bit, letto ? 1 : 0)
        .query(`
      UPDATE dbo.MessaggiInterni
      SET Letto = @letto, LettoAt = CASE WHEN @letto = 1 THEN SYSUTCDATETIME() ELSE NULL END
      WHERE Id = @id AND TenantId = @tenantId
    `);
}
export async function deleteMessaggioInterno(cfg, tenantId, id) {
    const pool = await getPool(cfg);
    await pool
        .request()
        .input("tenantId", sql.UniqueIdentifier, tenantId)
        .input("id", sql.UniqueIdentifier, id)
        .query(`DELETE FROM dbo.MessaggiInterni WHERE Id = @id AND TenantId = @tenantId`);
}
export async function updateMessaggioInternoTesto(cfg, tenantId, id, testo) {
    const pool = await getPool(cfg);
    await pool
        .request()
        .input("tenantId", sql.UniqueIdentifier, tenantId)
        .input("id", sql.UniqueIdentifier, id)
        .input("testo", sql.NVarChar(sql.MAX), testo)
        .query(`
      UPDATE dbo.MessaggiInterni
      SET Testo = @testo, Letto = 0, LettoAt = NULL
      WHERE Id = @id AND TenantId = @tenantId
    `);
}
export async function deleteMessaggiInterniByPratica(cfg, tenantId, praticaId) {
    const pool = await getPool(cfg);
    await pool
        .request()
        .input("tenantId", sql.UniqueIdentifier, tenantId)
        .input("praticaId", sql.UniqueIdentifier, praticaId)
        .query(`DELETE FROM dbo.MessaggiInterni WHERE TenantId = @tenantId AND PraticaId = @praticaId`);
}
