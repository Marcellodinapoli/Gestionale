import { sql, getPool } from "../db/pool.js";
const USER_COLUMNS = `
  u.Id, u.TenantId, u.Email, u.Name, u.PasswordHash, u.PasswordChangedAt,
  u.Role, u.Acronimo, u.FormazioneOnly, u.Interno, u.PrefissoChiamata,
  u.Active, u.SupervisorId, u.GruppoNome, u.GruppoMandantiJson,
  u.PostazioneId, u.PostazioneFissa, u.SedeId, u.LastLoginAt
`;
export async function getTenantBySlug(cfg, slug) {
    const pool = await getPool(cfg.db);
    const result = await pool
        .request()
        .input("slug", sql.NVarChar(50), slug.toLowerCase())
        .query(`
      SELECT Id, Slug, Nome, Active
      FROM dbo.Tenants
      WHERE Slug = @slug
    `);
    return result.recordset[0] ?? null;
}
export async function getUserByEmail(cfg, tenantId, email) {
    const pool = await getPool(cfg.db);
    const result = await pool
        .request()
        .input("tenantId", sql.UniqueIdentifier, tenantId)
        .input("email", sql.NVarChar(320), email.toLowerCase())
        .query(`
      SELECT Id, TenantId, Email, Name, PasswordHash, PasswordChangedAt,
        Role, Acronimo, FormazioneOnly, Interno, PrefissoChiamata,
        Active, SupervisorId, GruppoNome, GruppoMandantiJson,
        PostazioneId, PostazioneFissa, SedeId, LastLoginAt
      FROM dbo.Users
      WHERE TenantId = @tenantId AND Email = @email
    `);
    return result.recordset[0] ?? null;
}
export async function getUserById(cfg, tenantId, userId) {
    const pool = await getPool(cfg.db);
    const result = await pool
        .request()
        .input("tenantId", sql.UniqueIdentifier, tenantId)
        .input("userId", sql.UniqueIdentifier, userId)
        .query(`
      SELECT ${USER_COLUMNS}
      FROM dbo.Users u
      WHERE u.Id = @userId AND u.TenantId = @tenantId
    `);
    return result.recordset[0] ?? null;
}
export async function getUserSession(cfg, tenantId, userId) {
    const pool = await getPool(cfg.db);
    const result = await pool
        .request()
        .input("tenantId", sql.UniqueIdentifier, tenantId)
        .input("userId", sql.UniqueIdentifier, userId)
        .query(`
      SELECT
        ${USER_COLUMNS},
        t.Slug AS TenantSlug,
        t.Nome AS TenantNome,
        t.Active AS TenantActive,
        p.Interno AS PostazioneInterno,
        p.Email AS PostazioneEmail,
        p.Nome AS PostazioneNome,
        s.Nome AS SedeNome
      FROM dbo.Users u
      INNER JOIN dbo.Tenants t ON t.Id = u.TenantId
      LEFT JOIN dbo.Postazioni p ON p.Id = u.PostazioneId AND p.TenantId = u.TenantId
      LEFT JOIN dbo.Sedi s ON s.Id = u.SedeId AND s.TenantId = u.TenantId
      WHERE u.Id = @userId AND u.TenantId = @tenantId
    `);
    return result.recordset[0] ?? null;
}
export async function updateUserLogin(cfg, userId, data) {
    const pool = await getPool(cfg.db);
    const req = pool.request()
        .input("userId", sql.UniqueIdentifier, userId)
        .input("lastLoginAt", sql.DateTime2(3), new Date(data.lastLoginAt));
    const sets = ["LastLoginAt = @lastLoginAt"];
    if (data.postazioneId !== undefined) {
        req.input("postazioneId", sql.UniqueIdentifier, data.postazioneId);
        sets.push("PostazioneId = @postazioneId");
    }
    if (data.postazioneFissa !== undefined) {
        req.input("postazioneFissa", sql.Bit, data.postazioneFissa ? 1 : 0);
        sets.push("PostazioneFissa = @postazioneFissa");
    }
    await req.query(`
    UPDATE dbo.Users SET ${sets.join(", ")}
    WHERE Id = @userId
  `);
}
export async function getPostazioneActive(cfg, tenantId, postazioneId) {
    const pool = await getPool(cfg.db);
    const result = await pool
        .request()
        .input("tenantId", sql.UniqueIdentifier, tenantId)
        .input("postazioneId", sql.UniqueIdentifier, postazioneId)
        .query(`
      SELECT Id, TenantId, SedeId, Nome, Active
      FROM dbo.Postazioni
      WHERE Id = @postazioneId AND TenantId = @tenantId AND Active = 1
    `);
    return result.recordset[0] ?? null;
}
