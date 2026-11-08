import "server-only";
import { neonQuery } from "@/lib/neon/pool";
import type {
  AuditCreateInput,
  AuditLogDto,
  AuditLogFilter,
  AuditRepository,
} from "@/lib/data/contracts/audit";

const MAX_TAKE = 25000;

function blankToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function toIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(String(value ?? ""));
  return Number.isNaN(parsed.getTime()) ? String(value ?? "") : parsed.toISOString();
}

function mapRow(row: Record<string, unknown>): AuditLogDto {
  const userId = row.UserId != null ? String(row.UserId) : null;
  const userName = row.UserName != null ? String(row.UserName) : null;
  return {
    id: String(row.Id),
    tenantId: row.TenantId != null ? String(row.TenantId) : null,
    userId,
    action: String(row.Action),
    entity: String(row.Entity),
    entityId: row.EntityId != null ? String(row.EntityId) : null,
    dettaglio: row.MetadataJson != null ? String(row.MetadataJson) : null,
    createdAt: toIso(row.CreatedAt),
    user: userId && userName ? { id: userId, name: userName } : null,
  };
}

function listQuery(tenantId: string, filter?: AuditLogFilter): { text: string; params: unknown[] } {
  const params: unknown[] = [tenantId];
  const where = [`a."TenantId" = $1::uuid`];
  let i = 2;

  if (filter?.userId) {
    where.push(`a."UserId" = $${i++}::uuid`);
    params.push(filter.userId);
  }
  if (filter?.entity) {
    where.push(`a."Entity" = $${i++}`);
    params.push(filter.entity);
  }
  if (filter?.entityId) {
    where.push(`a."EntityId" = $${i++}`);
    params.push(filter.entityId);
  }
  if (filter?.entityIdsIn) {
    if (filter.entityIdsIn.length === 0) where.push("FALSE");
    else {
      where.push(`a."EntityId" = ANY($${i++}::text[])`);
      params.push(filter.entityIdsIn);
    }
  }
  if (filter?.action !== undefined) {
    const actions = Array.isArray(filter.action) ? filter.action : [filter.action];
    if (actions.length === 0) where.push("FALSE");
    else {
      where.push(`a."Action" = ANY($${i++}::text[])`);
      params.push(actions);
    }
  }
  if (filter?.createdAtGte) {
    where.push(`a."CreatedAt" >= $${i++}::timestamptz`);
    params.push(filter.createdAtGte);
  }
  if (filter?.createdAtLt) {
    where.push(`a."CreatedAt" < $${i++}::timestamptz`);
    params.push(filter.createdAtLt);
  }

  const take = Math.min(Math.max(filter?.take ?? 100, 1), MAX_TAKE);
  const skip = Math.max(filter?.skip ?? 0, 0);
  const order = filter?.orderBy === "asc" ? "ASC" : "DESC";
  const limitIdx = i++;
  const offsetIdx = i++;
  params.push(take, skip);

  const userCol = filter?.includeUser ? `, u."Name" AS "UserName"` : "";
  const join = filter?.includeUser ? `LEFT JOIN "Users" u ON u."Id" = a."UserId"` : "";

  return {
    text: `SELECT a."Id", a."TenantId", a."UserId", a."Action", a."Entity", a."EntityId",
              a."MetadataJson", a."CreatedAt"${userCol}
       FROM "AuditLog" a
       ${join}
       WHERE ${where.join(" AND ")}
       ORDER BY a."CreatedAt" ${order}
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    params,
  };
}

export class NeonAuditRepository implements AuditRepository {
  constructor(private _tenantSlug: string) {}

  async append(_tenantSlug: string, input: AuditCreateInput): Promise<void> {
    let tenantId = blankToNull(input.tenantId);
    const userId = blankToNull(input.userId);
    if (!tenantId && userId) {
      const rows = await neonQuery<{ TenantId: string }>(
        `SELECT "TenantId" FROM "Users" WHERE "Id" = $1::uuid LIMIT 1`,
        [userId]
      );
      tenantId = rows[0]?.TenantId ? String(rows[0].TenantId) : null;
    }

    await neonQuery(
      `INSERT INTO "AuditLog"
         ("Id","TenantId","UserId","Action","Entity","EntityId","MetadataJson","CreatedAt")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7, NOW())`,
      [
        crypto.randomUUID(),
        tenantId,
        userId,
        input.action,
        input.entity,
        blankToNull(input.entityId),
        input.dettaglio ?? null,
      ]
    );
  }

  async list(
    _tenantSlug: string,
    tenantId: string,
    filter?: AuditLogFilter
  ): Promise<AuditLogDto[]> {
    const query = listQuery(tenantId, filter);
    const rows = await neonQuery<Record<string, unknown>>(query.text, query.params);
    return rows.map((row) => mapRow(row));
  }
}

export function createNeonAuditRepository(tenantSlug: string) {
  return new NeonAuditRepository(tenantSlug);
}
