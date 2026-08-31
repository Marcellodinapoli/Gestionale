import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isConnectorProvider } from "@/lib/data/factory";
import { createConnectorDocumentiRepository } from "@/lib/data/connector/ConnectorDocumentiRepository";
import { prismaDocumentiRepository } from "@/lib/data/prisma/PrismaDocumentiRepository";
import type { DocumentiRepository } from "@/lib/data/contracts/documenti";
import { resolveTenantSlug, type PraticaDbContext } from "@/lib/praticheRepo";
import type { SessionUser } from "@/lib/permissions";

export type DocumentiDbContext = Pick<PraticaDbContext, "tenantId" | "tenantSlug">;

function repo(ctx: DocumentiDbContext): DocumentiRepository {
  if (isConnectorProvider()) return createConnectorDocumentiRepository(ctx.tenantSlug);
  return prismaDocumentiRepository;
}

export function documentiDbFromUser(user: SessionUser) {
  return documentiDb({ tenantId: user.tenantId, tenantSlug: resolveTenantSlug(user) });
}

export function documentiDb(ctx: DocumentiDbContext): typeof prisma.documento {
  if (!isConnectorProvider()) return prisma.documento;

  const r = repo(ctx);
  return {
    create: async (args: Prisma.DocumentoCreateArgs) => {
      const data = args.data as Record<string, unknown>;
      return r.create(ctx.tenantSlug, ctx.tenantId, {
        praticaId: String(data.praticaId),
        nome: String(data.nome),
        tipo: data.tipo != null ? String(data.tipo) : undefined,
        path: data.path != null ? String(data.path) : null,
      }) as never;
    },
    deleteMany: async (args: Prisma.DocumentoDeleteManyArgs) => {
      const where = args.where as { praticaId?: string } | undefined;
      const result = await r.deleteMany(ctx.tenantSlug, ctx.tenantId, {
        praticaId: where?.praticaId,
      });
      return { count: result.count } as never;
    },
  } as unknown as typeof prisma.documento;
}
