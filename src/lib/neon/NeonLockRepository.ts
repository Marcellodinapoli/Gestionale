import "server-only";
import type { QueryResultRow } from "@neondatabase/serverless";
import { getNeonPool } from "@/lib/neon/pool";
import type {
  LockRepository,
  LockTenantScope,
  PraticaLockStatus,
} from "@/lib/data/contracts/lock";
import { PRATICA_LOCK_TTL_MS } from "@/lib/data/contracts/lock";

const TTL_SEC = Math.ceil(PRATICA_LOCK_TTL_MS / 1000);

type Q = <R extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
) => Promise<R[]>;

async function withTx<T>(fn: (q: Q) => Promise<T>): Promise<T> {
  const client = await getNeonPool().connect();
  try {
    await client.query("BEGIN");
    const q: Q = async (text, params = []) => {
      const res = await client.query(text, params);
      return res.rows as never;
    };
    const result = await fn(q);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

function mapStatus(
  row: { UserId?: string; UserName?: string } | undefined,
  userId: string
): PraticaLockStatus {
  if (!row?.UserId) return { owned: false, lockedBy: null };
  if (String(row.UserId).toLowerCase() === userId.toLowerCase()) {
    return { owned: true, lockedBy: null };
  }
  return {
    owned: false,
    lockedBy: { id: String(row.UserId), name: String(row.UserName || "Operatore") },
  };
}

export class NeonLockRepository implements LockRepository {
  constructor(private scope: LockTenantScope) {}

  private async verifyPratica(q: Q, praticaId: string) {
    const rows = await q(
      `SELECT 1 AS ok FROM "Pratiche"
       WHERE "Id" = $1::uuid AND "TenantId" = $2::uuid LIMIT 1`,
      [praticaId, this.scope.tenantId]
    );
    if (!rows.length) throw new Error("Pratica non trovata");
  }

  async acquire(praticaId: string, userId: string): Promise<PraticaLockStatus> {
    return withTx(async (q) => {
      await this.verifyPratica(q, praticaId);
      await q(
        `DELETE FROM "PraticheLock"
         WHERE "PraticaId" = $1::uuid
           AND "LastHeartbeatAt" < NOW() - ($2::int * INTERVAL '1 second')`,
        [praticaId, TTL_SEC]
      );
      const existing = await q<{ UserId: string; UserName: string }>(
        `SELECT l."UserId", u."Name" AS "UserName"
         FROM "PraticheLock" l
         INNER JOIN "Users" u ON u."Id" = l."UserId"
         WHERE l."PraticaId" = $1::uuid
         FOR UPDATE`,
        [praticaId]
      );
      const row = existing[0];
      if (!row) {
        await q(
          `INSERT INTO "PraticheLock" ("PraticaId","TenantId","UserId","LastHeartbeatAt","CreatedAt")
           VALUES ($1::uuid,$2::uuid,$3::uuid,NOW(),NOW())`,
          [praticaId, this.scope.tenantId, userId]
        );
        return { owned: true, lockedBy: null };
      }
      if (String(row.UserId).toLowerCase() !== userId.toLowerCase()) {
        return mapStatus(row, userId);
      }
      await q(
        `UPDATE "PraticheLock" SET "LastHeartbeatAt" = NOW()
         WHERE "PraticaId" = $1::uuid`,
        [praticaId]
      );
      return { owned: true, lockedBy: null };
    });
  }

  async getStatus(praticaId: string, userId: string): Promise<PraticaLockStatus> {
    await neonPurge(praticaId);
    const rows = await getNeonPool().query(
      `SELECT l."UserId", u."Name" AS "UserName"
       FROM "PraticheLock" l
       INNER JOIN "Users" u ON u."Id" = l."UserId"
       WHERE l."PraticaId" = $1::uuid AND l."TenantId" = $2::uuid`,
      [praticaId, this.scope.tenantId]
    );
    return mapStatus(rows.rows[0] as { UserId: string; UserName: string } | undefined, userId);
  }

  async renew(praticaId: string, userId: string): Promise<PraticaLockStatus> {
    const status = await withTx(async (q) => {
      await q(
        `DELETE FROM "PraticheLock"
         WHERE "PraticaId" = $1::uuid
           AND "LastHeartbeatAt" < NOW() - ($2::int * INTERVAL '1 second')`,
        [praticaId, TTL_SEC]
      );
      const existing = await q<{ UserId: string; UserName: string }>(
        `SELECT l."UserId", u."Name" AS "UserName"
         FROM "PraticheLock" l
         INNER JOIN "Users" u ON u."Id" = l."UserId"
         WHERE l."PraticaId" = $1::uuid
         FOR UPDATE`,
        [praticaId]
      );
      const row = existing[0];
      if (!row) return null;
      if (String(row.UserId).toLowerCase() !== userId.toLowerCase()) {
        return mapStatus(row, userId);
      }
      await q(
        `UPDATE "PraticheLock" SET "LastHeartbeatAt" = NOW() WHERE "PraticaId" = $1::uuid`,
        [praticaId]
      );
      return { owned: true, lockedBy: null } as PraticaLockStatus;
    });
    if (status) return status;
    return this.acquire(praticaId, userId);
  }

  async release(praticaId: string, userId: string) {
    await getNeonPool().query(
      `DELETE FROM "PraticheLock"
       WHERE "PraticaId" = $1::uuid AND "UserId" = $2::uuid AND "TenantId" = $3::uuid`,
      [praticaId, userId, this.scope.tenantId]
    );
  }

  async releaseAllForUser(userId: string) {
    await getNeonPool().query(
      `DELETE FROM "PraticheLock" WHERE "UserId" = $1::uuid AND "TenantId" = $2::uuid`,
      [userId, this.scope.tenantId]
    );
  }

  async releaseForPratica(praticaId: string) {
    await getNeonPool().query(
      `DELETE FROM "PraticheLock" WHERE "PraticaId" = $1::uuid AND "TenantId" = $2::uuid`,
      [praticaId, this.scope.tenantId]
    );
  }

  async findActiveByPraticaIds(praticaIds: string[]) {
    if (!praticaIds.length) return [];
    await getNeonPool().query(
      `DELETE FROM "PraticheLock"
       WHERE "TenantId" = $1::uuid
         AND "LastHeartbeatAt" < NOW() - ($2::int * INTERVAL '1 second')`,
      [this.scope.tenantId, TTL_SEC]
    );
    const res = await getNeonPool().query(
      `SELECT l."PraticaId", l."UserId", u."Name" AS "UserName"
       FROM "PraticheLock" l
       INNER JOIN "Users" u ON u."Id" = l."UserId"
       WHERE l."TenantId" = $1::uuid AND l."PraticaId" = ANY($2::uuid[])`,
      [this.scope.tenantId, praticaIds]
    );
    return res.rows.map((r) => ({
      praticaId: String((r as { PraticaId: string }).PraticaId),
      userId: String((r as { UserId: string }).UserId),
      userName: String((r as { UserName: string }).UserName),
    }));
  }
}

async function neonPurge(praticaId: string) {
  await getNeonPool().query(
    `DELETE FROM "PraticheLock"
     WHERE "PraticaId" = $1::uuid
       AND "LastHeartbeatAt" < NOW() - ($2::int * INTERVAL '1 second')`,
    [praticaId, TTL_SEC]
  );
}

export function createNeonLockRepository(scope: LockTenantScope): LockRepository {
  return new NeonLockRepository(scope);
}
