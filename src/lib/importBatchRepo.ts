import "server-only";
import { isConnectorProvider } from "@/lib/data/factory";
import { createConnectorImportBatchRepository } from "@/lib/data/connector/ConnectorImportBatchRepository";
import { prismaImportBatchRepository } from "@/lib/data/prisma/PrismaImportBatchRepository";
import type { ImportBatchRepository } from "@/lib/data/contracts/importBatch";
import { resolveTenantSlug, type PraticaDbContext } from "@/lib/praticheRepo";

export type ImportDbContext = Pick<PraticaDbContext, "tenantId" | "tenantSlug">;

function repo(ctx: ImportDbContext): ImportBatchRepository {
  if (isConnectorProvider()) return createConnectorImportBatchRepository(ctx.tenantSlug);
  return prismaImportBatchRepository;
}

export function importBatchRepo(ctx: ImportDbContext): ImportBatchRepository {
  return repo(ctx);
}

export function importBatchRepoFromUser(user: { tenantId: string; tenantSlug?: string | null }) {
  return importBatchRepo({ tenantId: user.tenantId, tenantSlug: resolveTenantSlug(user) });
}
