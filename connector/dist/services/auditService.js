import { sql, getPool } from "../db/pool.js";
function mapRow(r) {
    return {
        id: String(r.Id),
        tenantId: r.TenantId != null ? String(r.TenantId) : null,
        userId: r.UserId != null ? String(r.UserId) : null,
        action: String(r.Action),
        entity: String(r.Entity),
        entityId: r.EntityId != null ? String(r.EntityId) : null,
        dettaglio: r.MetadataJson != null ? String(r.MetadataJson) : null,
        createdAt: new Date(String(r.CreatedAt)).toISOString(),
        user: r.UserName != null ? { id: String(r.UserId), name: String(r.UserName) } : null,
    };
}
export async function appendAuditLog(cfg, tenantId, input) {
    const pool = await getPool(cfg);
    const req = pool.request();
    req.input("tenantId", sql.UniqueIdentifier, input.tenantId ?? tenantId);
    if (input.userId)
        req.input("userId", sql.UniqueIdentifier, input.userId);
    req.input("action", sql.NVarChar(100), input.action);
    req.input("entity", sql.NVarChar(100), input.entity);
    if (input.entityId)
        req.input("entityId", sql.NVarChar(100), input.entityId);
    if (input.dettaglio)
        req.input("metadata", sql.NVarChar(sql.MAX), input.dettaglio);
    await req.query(`
    INSERT INTO dbo.AuditLog (TenantId, UserId, Action, Entity, EntityId, MetadataJson, CreatedAt)
    VALUES (
      @tenantId,
      ${input.userId ? "@userId" : "NULL"},
      @action,
      @entity,
      ${input.entityId ? "@entityId" : "NULL"},
      ${input.dettaglio ? "@metadata" : "NULL"},
      SYSUTCDATETIME()
    )
  `);
}
export async function listAuditLogs(cfg, tenantId, filter) {
    const pool = await getPool(cfg);
    const req = pool.request();
    req.input("tenantId", sql.UniqueIdentifier, tenantId);
    const clauses = ["a.TenantId = @tenantId"];
    if (filter?.userId) {
        req.input("userId", sql.UniqueIdentifier, filter.userId);
        clauses.push("a.UserId = @userId");
    }
    if (filter?.entity) {
        req.input("entity", sql.NVarChar(100), filter.entity);
        clauses.push("a.Entity = @entity");
    }
    if (filter?.entityId) {
        req.input("entityId", sql.NVarChar(100), filter.entityId);
        clauses.push("a.EntityId = @entityId");
    }
    if (filter?.entityIdsIn?.length) {
        filter.entityIdsIn.forEach((id, i) => req.input(`eid${i}`, sql.NVarChar(100), id));
        clauses.push(`a.EntityId IN (${filter.entityIdsIn.map((_, i) => `@eid${i}`).join(", ")})`);
    }
    if (filter?.action) {
        const actions = Array.isArray(filter.action) ? filter.action : [filter.action];
        actions.forEach((a, i) => req.input(`act${i}`, sql.NVarChar(100), a));
        clauses.push(`a.Action IN (${actions.map((_, i) => `@act${i}`).join(", ")})`);
    }
    if (filter?.createdAtGte) {
        req.input("gte", sql.DateTime2, new Date(filter.createdAtGte));
        clauses.push("a.CreatedAt >= @gte");
    }
    if (filter?.createdAtLt) {
        req.input("lt", sql.DateTime2, new Date(filter.createdAtLt));
        clauses.push("a.CreatedAt < @lt");
    }
    const take = Math.min(filter?.take ?? 100, 500);
    const order = filter?.orderBy === "asc" ? "ASC" : "DESC";
    req.input("take", sql.Int, take);
    const join = filter?.includeUser ? "LEFT JOIN dbo.Users u ON u.Id = a.UserId" : "";
    const userCol = filter?.includeUser ? ", u.Name AS UserName" : "";
    const res = await req.query(`
    SELECT TOP (@take) a.*${userCol}
    FROM dbo.AuditLog a
    ${join}
    WHERE ${clauses.join(" AND ")}
    ORDER BY a.CreatedAt ${order}
  `);
    return res.recordset.map((r) => mapRow(r));
}
