import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isConnectorProvider } from "@/lib/data/factory";
import { createConnectorFattureRepository } from "@/lib/data/connector/ConnectorFattureRepository";
import { prismaFattureRepository } from "@/lib/data/prisma/PrismaFattureRepository";
import type { FattureRepository } from "@/lib/data/contracts/fatture";
import { resolveTenantSlug, type PraticaDbContext } from "@/lib/praticheRepo";
import type { SessionUser } from "@/lib/permissions";

export type FattureDbContext = Pick<PraticaDbContext, "tenantId" | "tenantSlug">;

function repo(ctx: FattureDbContext): FattureRepository {
  if (isConnectorProvider()) return createConnectorFattureRepository(ctx.tenantSlug);
  return prismaFattureRepository;
}

export function fattureDbFromUser(user: SessionUser) {
  return fattureDb({ tenantId: user.tenantId, tenantSlug: resolveTenantSlug(user) });
}

export function fattureDb(ctx: FattureDbContext): typeof prisma.fattura {
  if (!isConnectorProvider()) return prisma.fattura;

  const r = repo(ctx);
  return {
    create: async (args: Prisma.FatturaCreateArgs) => {
      const data = args.data as Record<string, unknown>;
      return r.create(ctx.tenantSlug, ctx.tenantId, {
        praticaId: String(data.praticaId),
        numero: String(data.numero),
        causale: data.causale != null ? String(data.causale) : undefined,
        importo: Number(data.importo),
        pagato: data.pagato != null ? Number(data.pagato) : undefined,
        dataFattura: data.dataFattura as Date | string,
        dataScadenza: data.dataScadenza as Date | string,
      }) as never;
    },
    deleteMany: async (args: Prisma.FatturaDeleteManyArgs) => {
      const where = args.where as { praticaId?: string } | undefined;
      const result = await r.deleteMany(ctx.tenantSlug, ctx.tenantId, {
        praticaId: where?.praticaId,
      });
      return { count: result.count } as never;
    },
  } as unknown as typeof prisma.fattura;
}
