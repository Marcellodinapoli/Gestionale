import "server-only";
import { findTenantById, findUserAuditContext } from "@/lib/data/operationalAccess";
import { isConnectorProvider } from "@/lib/data/factory";
import { createConnectorAuditRepository } from "@/lib/data/connector/ConnectorAuditRepository";
import { prismaAuditRepository } from "@/lib/data/prisma/PrismaAuditRepository";
import type { AuditCreateInput, AuditRepository } from "@/lib/data/contracts/audit";
import { resolveTenantSlug, type PraticaDbContext } from "@/lib/praticheRepo";

export type AuditDbContext = Pick<PraticaDbContext, "tenantId" | "tenantSlug">;

function repo(ctx: AuditDbContext): AuditRepository {
  if (isConnectorProvider()) return createConnectorAuditRepository(ctx.tenantSlug);
  return prismaAuditRepository;
}

export function auditRepo(ctx: AuditDbContext): AuditRepository {
  return repo(ctx);
}

export function auditRepoFromTenant(tenantId: string, tenantSlug?: string) {
  return auditRepo({ tenantId, tenantSlug: tenantSlug ?? tenantId });
}

export function auditRepoFromUser(user: { tenantId: string; tenantSlug?: string | null }) {
  return auditRepo({ tenantId: user.tenantId, tenantSlug: resolveTenantSlug(user) });
}

async function resolveAuditTenant(input: AuditCreateInput & { tenantSlug?: string }) {
  let tenantId = input.tenantId ?? null;
  let slug = input.tenantSlug ?? null;

  if (tenantId && !slug) {
    const t = await findTenantById(tenantId);
    slug = t?.slug ?? tenantId;
  }

  if (!tenantId && input.userId) {
    const ctx = await findUserAuditContext(input.userId);
    tenantId = ctx?.tenantId ?? null;
    slug = slug ?? ctx?.tenantSlug ?? null;
  }

  if (!tenantId || !slug) return null;
  return { tenantId, slug };
}

/** Risolve contesto tenant e scrive audit (append-only). Nessun lookup Prisma diretto. */
export async function appendAudit(input: AuditCreateInput & { tenantSlug?: string }) {
  const ctx = await resolveAuditTenant(input);
  if (!ctx) return;

  await auditRepo({ tenantId: ctx.tenantId, tenantSlug: ctx.slug }).append(ctx.slug, {
    tenantId: ctx.tenantId,
    userId: input.userId ?? null,
    action: input.action,
    entity: input.entity,
    entityId: input.entityId ?? null,
    dettaglio: input.dettaglio ?? null,
  });
}
