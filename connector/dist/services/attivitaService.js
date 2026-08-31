import { sql, getPool } from "../db/pool.js";
const ATTIVITA_COLS = `
  a.Id, a.TenantId, a.PraticaId, a.UserId, a.Tipo, a.Esito, a.Nota,
  a.ScheduledAt, a.Fissata, a.Importante, a.Bloccata, a.CreatedAt
`;
function bindAttivitaFilter(req, tenantId, filter, alias = "a") {
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
    if (filter?.tipo) {
        req.input("tipo", sql.NVarChar(50), filter.tipo);
        clauses.push(`${alias}.Tipo = @tipo`);
    }
    if (filter?.fissata === true) {
        clauses.push(`${alias}.Fissata = 1`);
    }
    else if (filter?.fissata === false) {
        clauses.push(`${alias}.Fissata = 0`);
    }
    if (filter?.createdAtGte) {
        req.input("createdAtGte", sql.DateTime2, new Date(filter.createdAtGte));
        clauses.push(`${alias}.CreatedAt >= @createdAtGte`);
    }
    if (filter?.createdAtLte) {
        req.input("createdAtLte", sql.DateTime2, new Date(filter.createdAtLte));
        clauses.push(`${alias}.CreatedAt <= @createdAtLte`);
    }
    if (filter?.userRoleIn?.length) {
        join = ` INNER JOIN dbo.Users u ON u.Id = ${alias}.UserId `;
        filter.userRoleIn.forEach((role, idx) => req.input(`role${idx}`, sql.NVarChar(30), role));
        clauses.push(`u.Role IN (${filter.userRoleIn.map((_, idx) => `@role${idx}`).join(", ")})`);
    }
    return { where: clauses.join(" AND "), join };
}
export async function listAttivita(cfg, req) {
    const pool = await getPool(cfg);
    const take = req.take ?? 5000;
    const skip = req.skip ?? 0;
    const order = req.orderBy?.createdAt === "asc" ? "ASC" : "DESC";
    const countReq = pool.request();
    const { where: countWhere, join: countJoin } = bindAttivitaFilter(countReq, req.tenantId, req.filter);
    const countRes = await countReq.query(`
    SELECT COUNT(*) AS Total FROM dbo.Attivita a ${countJoin} WHERE ${countWhere}
  `);
    const total = Number(countRes.recordset[0]?.Total ?? 0);
    const listReq = pool.request();
    let { where, join } = bindAttivitaFilter(listReq, req.tenantId, req.filter);
    if (req.includeUser && !join.includes("dbo.Users")) {
        join += ` INNER JOIN dbo.Users u ON u.Id = a.UserId `;
    }
    listReq.input("skip", sql.Int, skip);
    listReq.input("take", sql.Int, take);
    let select = ATTIVITA_COLS;
    if (req.includeUser) {
        select += `, u.Id AS User_Id, u.Name AS User_Name`;
    }
    const result = await listReq.query(`
    SELECT ${select}
    FROM dbo.Attivita a
    ${join}
    WHERE ${where}
    ORDER BY a.CreatedAt ${order}
    OFFSET @skip ROWS FETCH NEXT @take ROWS ONLY
  `);
    const items = result.recordset.map((row) => {
        if (req.includeUser && row.User_Id != null) {
            return {
                ...row,
                user: { Id: row.User_Id, Name: row.User_Name },
            };
        }
        return row;
    });
    return { items, total };
}
export async function countAttivita(cfg, tenantId, filter) {
    const pool = await getPool(cfg);
    const req = pool.request();
    const { where, join } = bindAttivitaFilter(req, tenantId, filter);
    const res = await req.query(`SELECT COUNT(*) AS Total FROM dbo.Attivita a ${join} WHERE ${where}`);
    return Number(res.recordset[0]?.Total ?? 0);
}
export async function groupByUserIdAttivita(cfg, tenantId, filter) {
    const pool = await getPool(cfg);
    const req = pool.request();
    const { where, join } = bindAttivitaFilter(req, tenantId, filter);
    const res = await req.query(`
    SELECT a.UserId AS userId, COUNT(*) AS cnt
    FROM dbo.Attivita a
    ${join}
    WHERE ${where}
    GROUP BY a.UserId
  `);
    return res.recordset.map((r) => ({
        userId: String(r.userId),
        _count: Number(r.cnt),
    }));
}
export async function getAttivitaById(cfg, tenantId, id) {
    const pool = await getPool(cfg);
    const res = await pool
        .request()
        .input("tenantId", sql.UniqueIdentifier, tenantId)
        .input("id", sql.UniqueIdentifier, id)
        .query(`SELECT ${ATTIVITA_COLS} FROM dbo.Attivita a WHERE a.TenantId = @tenantId AND a.Id = @id`);
    return res.recordset[0] ?? null;
}
export async function createAttivita(cfg, tenantId, data) {
    const pool = await getPool(cfg);
    const res = await pool
        .request()
        .input("tenantId", sql.UniqueIdentifier, tenantId)
        .input("praticaId", sql.UniqueIdentifier, data.praticaId)
        .input("userId", sql.UniqueIdentifier, data.userId)
        .input("tipo", sql.NVarChar(50), data.tipo)
        .input("esito", sql.NVarChar(50), data.esito ?? null)
        .input("nota", sql.NVarChar(sql.MAX), data.nota ?? null)
        .input("scheduledAt", sql.DateTime2, data.scheduledAt ? new Date(data.scheduledAt) : null)
        .input("fissata", sql.Bit, data.fissata ? 1 : 0)
        .input("importante", sql.Bit, data.importante ? 1 : 0)
        .input("bloccata", sql.Bit, data.bloccata ? 1 : 0)
        .query(`
      INSERT INTO dbo.Attivita (
        TenantId, PraticaId, UserId, Tipo, Esito, Nota, ScheduledAt, Fissata, Importante, Bloccata
      )
      OUTPUT INSERTED.*
      VALUES (
        @tenantId, @praticaId, @userId, @tipo, @esito, @nota, @scheduledAt,
        @fissata, @importante, @bloccata
      )
    `);
    return res.recordset[0];
}
export async function updateAttivita(cfg, tenantId, id, data) {
    const pool = await getPool(cfg);
    const sets = [];
    const req = pool
        .request()
        .input("tenantId", sql.UniqueIdentifier, tenantId)
        .input("id", sql.UniqueIdentifier, id);
    if (data.nota !== undefined) {
        req.input("nota", sql.NVarChar(sql.MAX), data.nota);
        sets.push("Nota = @nota");
    }
    if (data.fissata !== undefined) {
        req.input("fissata", sql.Bit, data.fissata ? 1 : 0);
        sets.push("Fissata = @fissata");
    }
    if (data.importante !== undefined) {
        req.input("importante", sql.Bit, data.importante ? 1 : 0);
        sets.push("Importante = @importante");
    }
    if (data.bloccata !== undefined) {
        req.input("bloccata", sql.Bit, data.bloccata ? 1 : 0);
        sets.push("Bloccata = @bloccata");
    }
    if (data.esito !== undefined) {
        req.input("esito", sql.NVarChar(50), data.esito);
        sets.push("Esito = @esito");
    }
    if (data.tipo !== undefined) {
        req.input("tipo", sql.NVarChar(50), data.tipo);
        sets.push("Tipo = @tipo");
    }
    if (!sets.length) {
        return getAttivitaById(cfg, tenantId, id);
    }
    const res = await req.query(`
    UPDATE dbo.Attivita SET ${sets.join(", ")}
    OUTPUT INSERTED.*
    WHERE TenantId = @tenantId AND Id = @id
  `);
    return res.recordset[0] ?? null;
}
export async function updateManyAttivita(cfg, tenantId, filter, data) {
    const pool = await getPool(cfg);
    const req = pool.request();
    const { where, join } = bindAttivitaFilter(req, tenantId, filter);
    const sets = [];
    if (data.fissata !== undefined) {
        req.input("fissata", sql.Bit, data.fissata ? 1 : 0);
        sets.push("a.Fissata = @fissata");
    }
    if (!sets.length)
        return { count: 0 };
    const res = await req.query(`
    UPDATE a SET ${sets.join(", ")}
    FROM dbo.Attivita a
    ${join}
    WHERE ${where}
  `);
    return { count: res.rowsAffected[0] ?? 0 };
}
export async function deleteManyAttivita(cfg, tenantId, filter) {
    const pool = await getPool(cfg);
    const req = pool.request();
    const { where, join } = bindAttivitaFilter(req, tenantId, filter);
    const res = await req.query(`
    DELETE a FROM dbo.Attivita a ${join} WHERE ${where}
  `);
    return { count: res.rowsAffected[0] ?? 0 };
}
export async function toggleFissaAttivita(cfg, tenantId, attivitaId, praticaId, fissata) {
    const pool = await getPool(cfg);
    const tx = new sql.Transaction(pool);
    await tx.begin();
    try {
        await new sql.Request(tx)
            .input("tenantId", sql.UniqueIdentifier, tenantId)
            .input("praticaId", sql.UniqueIdentifier, praticaId)
            .query(`
        UPDATE dbo.Attivita SET Fissata = 0
        WHERE TenantId = @tenantId AND PraticaId = @praticaId AND Fissata = 1
      `);
        if (fissata) {
            await new sql.Request(tx)
                .input("tenantId", sql.UniqueIdentifier, tenantId)
                .input("id", sql.UniqueIdentifier, attivitaId)
                .query(`
          UPDATE dbo.Attivita SET Fissata = 1
          WHERE TenantId = @tenantId AND Id = @id
        `);
        }
        await tx.commit();
    }
    catch (err) {
        await tx.rollback();
        throw err;
    }
}
