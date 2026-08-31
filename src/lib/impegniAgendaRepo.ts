import "server-only";
import { isConnectorProvider } from "@/lib/data/factory";
import { createConnectorImpegniAgendaRepository } from "@/lib/data/connector/ConnectorImpegniAgendaRepository";
import { prismaImpegniAgendaRepository } from "@/lib/data/prisma/PrismaImpegniAgendaRepository";
import type { ImpegniAgendaRepository } from "@/lib/data/contracts/impegniAgenda";
import { resolveTenantSlug, type PraticaDbContext } from "@/lib/praticheRepo";
import type { SessionUser } from "@/lib/permissions";

export type AgendaDbContext = Pick<PraticaDbContext, "tenantId" | "tenantSlug">;

function repo(ctx: AgendaDbContext): ImpegniAgendaRepository {
  if (isConnectorProvider()) return createConnectorImpegniAgendaRepository(ctx.tenantSlug);
  return prismaImpegniAgendaRepository;
}

export function impegniAgendaFromUser(user: SessionUser) {
  return impegniAgendaRepo({ tenantId: user.tenantId, tenantSlug: resolveTenantSlug(user) });
}

export function impegniAgendaRepo(ctx: AgendaDbContext): ImpegniAgendaRepository {
  return repo(ctx);
}
