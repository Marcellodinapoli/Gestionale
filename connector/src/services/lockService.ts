import { sql, getPool } from "../db/pool.js";
import type { ConnectorConfig } from "../config.js";

export const LOCK_TTL_SEC = 45;

export type LockStatusDto = {
  owned: boolean;
  lockedBy: { id: string; name: string } | null;
};

function mapRow(row: {
  UserId: string;
  UserName: string;
} | undefined, userId: string): LockStatusDto {
  if (!row) return { owned: false, lockedBy: null };
  const holderId = String(row.UserId).toLowerCase();
  if (holderId === userId.toLowerCase()) {
    return { owned: true, lockedBy: null };
  }
  return {
    owned: false,
    lockedBy: { id: String(row.UserId), name: row.UserName },
  };
}

async function verifyPratica(
  pool: Awaited<ReturnType<typeof getPool>>,
  tenantId: string,
  praticaId: string
) {
  const res = await pool
    .request()
    .input("tenantId", sql.UniqueIdentifier, tenantId)
    .input("praticaId", sql.UniqueIdentifier, praticaId)
    .query(`SELECT Id FROM dbo.Pratiche WHERE Id = @praticaId AND TenantId = @tenantId`);
  return Boolean(res.recordset[0]);
}

/** Lazy cleanup riga scaduta (alias opzionale). */
function purgeExpiredSql(alias?: string) {
  const col = alias ? `${alias}.LastHeartbeatAt` : "LastHeartbeatAt";
  return `${col} < DATEADD(second, -${LOCK_TTL_SEC}, SYSUTCDATETIME())`;
}

/**
 * Acquire con UPDLOCK/HOLDLOCK — una sola riga per PraticaId (PK).
 * Impedisce doppia acquisizione concorrente sulla stessa pratica.
 */
export async function acquireLock(
  cfg: ConnectorConfig["db"],
  tenantId: string,
  praticaId: string,
  userId: string
): Promise<LockStatusDto> {
  const pool = await getPool(cfg);
  if (!(await verifyPratica(pool, tenantId, praticaId))) {
    throw new Error("Pratica non trovata");
  }

  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    const req = new sql.Request(tx);
    req.input("tenantId", sql.UniqueIdentifier, tenantId);
    req.input("praticaId", sql.UniqueIdentifier, praticaId);
    req.input("userId", sql.UniqueIdentifier, userId);

    await req.query(`
      DELETE FROM dbo.PraticheLock
      WHERE PraticaId = @praticaId AND ${purgeExpiredSql()}
    `);

    const existing = await req.query(`
      SELECT l.UserId, l.LastHeartbeatAt, u.Name AS UserName
      FROM dbo.PraticheLock l WITH (UPDLOCK, HOLDLOCK)
      INNER JOIN dbo.Users u ON u.Id = l.UserId
      WHERE l.PraticaId = @praticaId
    `);

    const row = existing.recordset[0] as
      | { UserId: string; LastHeartbeatAt: Date; UserName: string }
      | undefined;

    if (!row) {
      await req.query(`
        INSERT INTO dbo.PraticheLock (PraticaId, TenantId, UserId, LastHeartbeatAt, CreatedAt)
        VALUES (@praticaId, @tenantId, @userId, SYSUTCDATETIME(), SYSUTCDATETIME())
      `);
      await tx.commit();
      return { owned: true, lockedBy: null };
    }

    const holderId = String(row.UserId).toLowerCase();
    if (holderId !== userId.toLowerCase()) {
      await tx.rollback();
      return {
        owned: false,
        lockedBy: { id: String(row.UserId), name: row.UserName },
      };
    }

    await req.query(`
      UPDATE dbo.PraticheLock
      SET UserId = @userId, LastHeartbeatAt = SYSUTCDATETIME()
      WHERE PraticaId = @praticaId
    `);
    await tx.commit();
    return { owned: true, lockedBy: null };
  } catch (err) {
    await tx.rollback().catch(() => undefined);
    throw err;
  }
}

export async function renewLock(
  cfg: ConnectorConfig["db"],
  tenantId: string,
  praticaId: string,
  userId: string
): Promise<LockStatusDto> {
  const pool = await getPool(cfg);
  if (!(await verifyPratica(pool, tenantId, praticaId))) {
    throw new Error("Pratica non trovata");
  }

  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    const req = new sql.Request(tx);
    req.input("tenantId", sql.UniqueIdentifier, tenantId);
    req.input("praticaId", sql.UniqueIdentifier, praticaId);
    req.input("userId", sql.UniqueIdentifier, userId);

    await req.query(`
      DELETE FROM dbo.PraticheLock
      WHERE PraticaId = @praticaId AND ${purgeExpiredSql()}
    `);

    const existing = await req.query(`
      SELECT l.UserId, u.Name AS UserName
      FROM dbo.PraticheLock l WITH (UPDLOCK, HOLDLOCK)
      INNER JOIN dbo.Users u ON u.Id = l.UserId
      WHERE l.PraticaId = @praticaId
    `);

    const row = existing.recordset[0] as { UserId: string; UserName: string } | undefined;

    if (!row) {
      await tx.rollback();
      return acquireLock(cfg, tenantId, praticaId, userId);
    }

    const holderId = String(row.UserId).toLowerCase();
    if (holderId !== userId.toLowerCase()) {
      await tx.rollback();
      return {
        owned: false,
        lockedBy: { id: String(row.UserId), name: row.UserName },
      };
    }

    await req.query(`
      UPDATE dbo.PraticheLock SET LastHeartbeatAt = SYSUTCDATETIME() WHERE PraticaId = @praticaId
    `);
    await tx.commit();
    return { owned: true, lockedBy: null };
  } catch (err) {
    await tx.rollback().catch(() => undefined);
    throw err;
  }
}

export async function releaseLock(
  cfg: ConnectorConfig["db"],
  tenantId: string,
  praticaId: string,
  userId: string
) {
  const pool = await getPool(cfg);
  await pool
    .request()
    .input("tenantId", sql.UniqueIdentifier, tenantId)
    .input("praticaId", sql.UniqueIdentifier, praticaId)
    .input("userId", sql.UniqueIdentifier, userId)
    .query(`
      DELETE l FROM dbo.PraticheLock l
      INNER JOIN dbo.Pratiche p ON p.Id = l.PraticaId AND p.TenantId = @tenantId
      WHERE l.PraticaId = @praticaId AND l.UserId = @userId
    `);
}

export async function releaseAllUserLocks(
  cfg: ConnectorConfig["db"],
  tenantId: string,
  userId: string
) {
  const pool = await getPool(cfg);
  await pool
    .request()
    .input("tenantId", sql.UniqueIdentifier, tenantId)
    .input("userId", sql.UniqueIdentifier, userId)
    .query(`DELETE FROM dbo.PraticheLock WHERE TenantId = @tenantId AND UserId = @userId`);
}

export async function releaseLockForPratica(
  cfg: ConnectorConfig["db"],
  tenantId: string,
  praticaId: string
) {
  const pool = await getPool(cfg);
  await pool
    .request()
    .input("tenantId", sql.UniqueIdentifier, tenantId)
    .input("praticaId", sql.UniqueIdentifier, praticaId)
    .query(`
      DELETE l FROM dbo.PraticheLock l
      INNER JOIN dbo.Pratiche p ON p.Id = l.PraticaId AND p.TenantId = @tenantId
      WHERE l.PraticaId = @praticaId
    `);
}

export async function getLockStatus(
  cfg: ConnectorConfig["db"],
  tenantId: string,
  praticaId: string,
  userId: string
): Promise<LockStatusDto> {
  const pool = await getPool(cfg);
  const req = pool.request();
  req.input("tenantId", sql.UniqueIdentifier, tenantId);
  req.input("praticaId", sql.UniqueIdentifier, praticaId);
  req.input("userId", sql.UniqueIdentifier, userId);

  await req.query(`
    DELETE l FROM dbo.PraticheLock l
    INNER JOIN dbo.Pratiche p ON p.Id = l.PraticaId AND p.TenantId = @tenantId
    WHERE l.PraticaId = @praticaId AND ${purgeExpiredSql("l")}
  `);

  const res = await pool
    .request()
    .input("tenantId", sql.UniqueIdentifier, tenantId)
    .input("praticaId", sql.UniqueIdentifier, praticaId)
    .input("userId", sql.UniqueIdentifier, userId)
    .query(`
      SELECT l.UserId, u.Name AS UserName
      FROM dbo.PraticheLock l
      INNER JOIN dbo.Pratiche p ON p.Id = l.PraticaId AND p.TenantId = @tenantId
      INNER JOIN dbo.Users u ON u.Id = l.UserId
      WHERE l.PraticaId = @praticaId
    `);

  return mapRow(res.recordset[0], userId);
}

export async function findActiveLocksByPraticaIds(
  cfg: ConnectorConfig["db"],
  tenantId: string,
  praticaIds: string[]
): Promise<Array<{ praticaId: string; userId: string; userName: string }>> {
  if (!praticaIds.length) return [];
  const pool = await getPool(cfg);
  const req = pool.request().input("tenantId", sql.UniqueIdentifier, tenantId);
  praticaIds.forEach((id, i) => req.input(`p${i}`, sql.UniqueIdentifier, id));
  const inList = praticaIds.map((_, i) => `@p${i}`).join(", ");
  const res = await req.query(`
    SELECT l.PraticaId, l.UserId, u.Name AS UserName
    FROM dbo.PraticheLock l
    INNER JOIN dbo.Pratiche p ON p.Id = l.PraticaId AND p.TenantId = @tenantId
    INNER JOIN dbo.Users u ON u.Id = l.UserId
    WHERE l.PraticaId IN (${inList})
      AND l.LastHeartbeatAt >= DATEADD(second, -${LOCK_TTL_SEC}, SYSUTCDATETIME())
  `);
  return res.recordset.map(
    (r: { PraticaId: string; UserId: string; UserName: string }) => ({
      praticaId: String(r.PraticaId),
      userId: String(r.UserId),
      userName: r.UserName,
    })
  );
}

/** Cleanup batch globale (ogni 5 min). */
export async function purgeExpiredLocksBatch(cfg: ConnectorConfig["db"]) {
  const pool = await getPool(cfg);
  await pool.request().query(`
    DELETE FROM dbo.PraticheLock WHERE ${purgeExpiredSql()}
  `);
}
