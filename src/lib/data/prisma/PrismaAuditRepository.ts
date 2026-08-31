import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  AuditCreateInput,
  AuditLogFilter,
  AuditRepository,
} from "../contracts/audit";

export class PrismaAuditRepository implements AuditRepository {
  async append(_tenantSlug: string, input: AuditCreateInput) {
    let tenantId = input.tenantId ?? null;
    if (!tenantId && input.userId) {
      const u = await prisma.user.findUnique({
        where: { id: input.userId },
        select: { tenantId: true },
      });
      tenantId = u?.tenantId ?? null;
    }
    await prisma.auditLog.create({
      data: {
        tenantId,
        userId: input.userId ?? null,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId ?? null,
        dettaglio: input.dettaglio ?? null,
      },
    });
  }

  async list(_tenantSlug: string, tenantId: string, filter?: AuditLogFilter) {
    const where: Prisma.AuditLogWhereInput = { tenantId };
    if (filter?.userId) where.userId = filter.userId;
    if (filter?.entity) where.entity = filter.entity;
    if (filter?.entityId) where.entityId = filter.entityId;
    if (filter?.entityIdsIn?.length) where.entityId = { in: filter.entityIdsIn };
    if (filter?.action) {
      where.action = Array.isArray(filter.action) ? { in: filter.action } : filter.action;
    }
    if (filter?.createdAtGte || filter?.createdAtLt) {
      where.createdAt = {
        ...(filter.createdAtGte ? { gte: new Date(filter.createdAtGte) } : {}),
        ...(filter.createdAtLt ? { lt: new Date(filter.createdAtLt) } : {}),
      };
    }
    const rows = filter?.includeUser
      ? await prisma.auditLog.findMany({
          where,
          include: { user: { select: { id: true, name: true } } },
          orderBy: { createdAt: filter?.orderBy === "asc" ? "asc" : "desc" },
          take: filter?.take ?? 100,
          skip: filter?.skip,
        })
      : await prisma.auditLog.findMany({
          where,
          orderBy: { createdAt: filter?.orderBy === "asc" ? "asc" : "desc" },
          take: filter?.take ?? 100,
          skip: filter?.skip,
        });
    return rows.map((r) => {
      const withUser = r as typeof r & { user?: { id: string; name: string } | null };
      return {
        id: r.id,
        tenantId: r.tenantId,
        userId: r.userId,
        action: r.action,
        entity: r.entity,
        entityId: r.entityId,
        dettaglio: r.dettaglio,
        createdAt: r.createdAt.toISOString(),
        user: withUser.user ? { id: withUser.user.id, name: withUser.user.name } : null,
      };
    });
  }
}

export const prismaAuditRepository = new PrismaAuditRepository();
