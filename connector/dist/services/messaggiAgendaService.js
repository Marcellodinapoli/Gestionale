import { sql, getPool } from "../db/pool.js";
function mapRow(r) {
    const row = {
        id: String(r.Id),
        praticaId: String(r.PraticaId),
        userId: String(r.UserId),
        memoAt: new Date(String(r.MemoAt)).toISOString(),
        line: String(r.Line),
        letto: Boolean(r.Letto),
        lettoAt: r.LettoAt ? new Date(String(r.LettoAt)).toISOString() : null,
        createdAt: new Date(String(r.CreatedAt)).toISOString(),
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
    if (r.UserName != null) {
        row.user = { id: String(r.UserId), name: String(r.UserName) };
    }
    return row;
}
export async function listMessaggiAgenda(cfg, tenantId, filter, take = 100) {
    const pool = await getPool(cfg);
    const req = pool.request();
    req.input("tenantId", sql.UniqueIdentifier, tenantId);
    req.input("take", sql.Int, take);
    const clauses = ["m.TenantId = @tenantId"];
    if (filter?.praticaId) {
        req.input("praticaId", sql.UniqueIdentifier, filter.praticaId);
        clauses.push("m.PraticaId = @praticaId");
    }
    if (filter?.praticaIdsIn?.length) {
        filter.praticaIdsIn.forEach((id, i) => req.input(`pid${i}`, sql.UniqueIdentifier, id));
        clauses.push(`m.PraticaId IN (${filter.praticaIdsIn.map((_, i) => `@pid${i}`).join(", ")})`);
    }
    if (filter?.letto === false)
        clauses.push("m.Letto = 0");
    if (filter?.letto === true)
        clauses.push("m.Letto = 1");
    const res = await req.query(`
    SELECT TOP (@take) m.*, p.Numero, d.Nome AS DebitoreNome, d.Cognome AS DebitoreCognome, u.Name AS UserName
    FROM dbo.MessaggiAgenda m
    INNER JOIN dbo.Pratiche p ON p.Id = m.PraticaId
    INNER JOIN dbo.Debitori d ON d.Id = p.DebitoreId
    INNER JOIN dbo.Users u ON u.Id = m.UserId
    WHERE ${clauses.join(" AND ")}
    ORDER BY m.CreatedAt DESC
  `);
    return res.recordset.map((r) => mapRow(r));
}
export async function findOpenMessaggioAgenda(cfg, tenantId, praticaId) {
    const rows = await listMessaggiAgenda(cfg, tenantId, { praticaId, letto: false }, 1);
    return rows[0] ?? null;
}
export async function upsertOpenMessaggioAgenda(cfg, tenantId, data) {
    const open = await findOpenMessaggioAgenda(cfg, tenantId, data.praticaId);
    const pool = await getPool(cfg);
    if (open) {
        await pool
            .request()
            .input("id", sql.UniqueIdentifier, open.id)
            .input("userId", sql.UniqueIdentifier, data.userId)
            .input("memoAt", sql.DateTime2, new Date(data.memoAt))
            .input("line", sql.NVarChar(500), data.line)
            .query(`
        UPDATE dbo.MessaggiAgenda
        SET UserId = @userId, MemoAt = @memoAt, Line = @line
        WHERE Id = @id
      `);
        return;
    }
    await pool
        .request()
        .input("tenantId", sql.UniqueIdentifier, tenantId)
        .input("praticaId", sql.UniqueIdentifier, data.praticaId)
        .input("userId", sql.UniqueIdentifier, data.userId)
        .input("memoAt", sql.DateTime2, new Date(data.memoAt))
        .input("line", sql.NVarChar(500), data.line)
        .query(`
      INSERT INTO dbo.MessaggiAgenda (TenantId, PraticaId, UserId, MemoAt, Line, Letto, CreatedAt)
      VALUES (@tenantId, @praticaId, @userId, @memoAt, @line, 0, SYSUTCDATETIME())
    `);
}
export async function markMessaggioAgendaLetto(cfg, tenantId, id) {
    const pool = await getPool(cfg);
    await pool
        .request()
        .input("tenantId", sql.UniqueIdentifier, tenantId)
        .input("id", sql.UniqueIdentifier, id)
        .query(`
      UPDATE dbo.MessaggiAgenda SET Letto = 1, LettoAt = SYSUTCDATETIME()
      WHERE Id = @id AND TenantId = @tenantId
    `);
}
export async function markMessaggiAgendaPraticaLetti(cfg, tenantId, praticaId) {
    const pool = await getPool(cfg);
    await pool
        .request()
        .input("tenantId", sql.UniqueIdentifier, tenantId)
        .input("praticaId", sql.UniqueIdentifier, praticaId)
        .query(`
      UPDATE dbo.MessaggiAgenda SET Letto = 1, LettoAt = SYSUTCDATETIME()
      WHERE TenantId = @tenantId AND PraticaId = @praticaId AND Letto = 0
    `);
}
export async function getMessaggioAgendaById(cfg, tenantId, id) {
    const pool = await getPool(cfg);
    const res = await pool
        .request()
        .input("tenantId", sql.UniqueIdentifier, tenantId)
        .input("id", sql.UniqueIdentifier, id)
        .query(`
      SELECT m.*, p.Numero, d.Nome AS DebitoreNome, d.Cognome AS DebitoreCognome, u.Name AS UserName
      FROM dbo.MessaggiAgenda m
      INNER JOIN dbo.Pratiche p ON p.Id = m.PraticaId
      INNER JOIN dbo.Debitori d ON d.Id = p.DebitoreId
      INNER JOIN dbo.Users u ON u.Id = m.UserId
      WHERE m.TenantId = @tenantId AND m.Id = @id
    `);
    const row = res.recordset[0];
    return row ? mapRow(row) : null;
}
export async function deleteMessaggiAgendaByPratica(cfg, tenantId, praticaId) {
    const pool = await getPool(cfg);
    await pool
        .request()
        .input("tenantId", sql.UniqueIdentifier, tenantId)
        .input("praticaId", sql.UniqueIdentifier, praticaId)
        .query(`DELETE FROM dbo.MessaggiAgenda WHERE TenantId = @tenantId AND PraticaId = @praticaId`);
}
