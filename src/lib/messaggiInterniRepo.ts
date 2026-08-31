import "server-only";
import { isConnectorProvider } from "@/lib/data/factory";
import { createConnectorMessaggiInterniRepository } from "@/lib/data/connector/ConnectorMessaggiInterniRepository";
import { prismaMessaggiInterniRepository } from "@/lib/data/prisma/PrismaMessaggiInterniRepository";
import type { MessaggiInterniRepository } from "@/lib/data/contracts/messaggiInterni";
import { resolveTenantSlug, type PraticaDbContext } from "@/lib/praticheRepo";
import type { SessionUser } from "@/lib/permissions";

export type AgendaDbContext = Pick<PraticaDbContext, "tenantId" | "tenantSlug">;

function repo(ctx: AgendaDbContext): MessaggiInterniRepository {
  if (isConnectorProvider()) return createConnectorMessaggiInterniRepository(ctx.tenantSlug);
  return prismaMessaggiInterniRepository;
}

export function messaggiInterniFromUser(user: SessionUser) {
  return messaggiInterniRepo({ tenantId: user.tenantId, tenantSlug: resolveTenantSlug(user) });
}

export function messaggiInterniRepo(ctx: AgendaDbContext): MessaggiInterniRepository {
  return repo(ctx);
}
