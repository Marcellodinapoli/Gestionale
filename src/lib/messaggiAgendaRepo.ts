import "server-only";
import { isConnectorProvider } from "@/lib/data/factory";
import { createConnectorMessaggiAgendaRepository } from "@/lib/data/connector/ConnectorMessaggiAgendaRepository";
import { prismaMessaggiAgendaRepository } from "@/lib/data/prisma/PrismaMessaggiAgendaRepository";
import type { MessaggiAgendaRepository } from "@/lib/data/contracts/messaggiAgenda";
import { resolveTenantSlug, type PraticaDbContext } from "@/lib/praticheRepo";
import type { SessionUser } from "@/lib/permissions";

export type AgendaDbContext = Pick<PraticaDbContext, "tenantId" | "tenantSlug">;

function repo(ctx: AgendaDbContext): MessaggiAgendaRepository {
  if (isConnectorProvider()) return createConnectorMessaggiAgendaRepository(ctx.tenantSlug);
  return prismaMessaggiAgendaRepository;
}

export function messaggiAgendaFromUser(user: SessionUser) {
  return messaggiAgendaRepo({ tenantId: user.tenantId, tenantSlug: resolveTenantSlug(user) });
}

export function messaggiAgendaRepo(ctx: AgendaDbContext): MessaggiAgendaRepository {
  return repo(ctx);
}
