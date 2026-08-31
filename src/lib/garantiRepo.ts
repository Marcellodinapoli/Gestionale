import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isConnectorProvider } from "@/lib/data/factory";
import { createConnectorGarantiRepository } from "@/lib/data/connector/ConnectorGarantiRepository";
import { prismaGarantiRepository } from "@/lib/data/prisma/PrismaGarantiRepository";
import type { GarantiRepository } from "@/lib/data/contracts/garanti";
import { applySelect } from "@/lib/data/mapSqlRow";
import { resolveTenantSlug, type PraticaDbContext } from "@/lib/praticheRepo";
import type { SessionUser } from "@/lib/permissions";

export type GarantiDbContext = Pick<PraticaDbContext, "tenantId" | "tenantSlug">;

function repo(ctx: GarantiDbContext): GarantiRepository {
  if (isConnectorProvider()) return createConnectorGarantiRepository(ctx.tenantSlug);
  return prismaGarantiRepository;
}

export function garantiDbFromUser(user: SessionUser) {
  return garantiDb({ tenantId: user.tenantId, tenantSlug: resolveTenantSlug(user) });
}

export function garantiDb(_ctx: GarantiDbContext): typeof prisma.garante {
  if (!isConnectorProvider()) return prisma.garante;

  const r = repo(_ctx);
  return {
    findFirst: async (args: Prisma.GaranteFindFirstArgs) => {
      const where = args.where as { id?: string; praticaId?: string } | undefined;
      const row = await r.findFirst(where ?? {});
      return row ? (applySelect(row, args.select) as never) : null;
    },
    findMany: async (args: Prisma.GaranteFindManyArgs) => {
      const where = args.where as { codiceFiscale?: { in?: string[] } } | undefined;
      const variants = where?.codiceFiscale?.in?.map(String) ?? [];
      const rows = await r.findManyByCf(_ctx.tenantSlug, _ctx.tenantId, variants);
      return rows.map((row) => applySelect(row, args.select)) as never[];
    },
    update: async (args: Prisma.GaranteUpdateArgs) => {
      const id = String((args.where as { id?: string })?.id || "");
      return r.update(_ctx.tenantSlug, _ctx.tenantId, id, args.data as never) as never;
    },
    deleteMany: async (args: Prisma.GaranteDeleteManyArgs) => {
      const where = args.where as { praticaId?: string } | undefined;
      if (where?.praticaId) {
        await r.deleteManyByPratica(_ctx.tenantSlug, _ctx.tenantId, where.praticaId);
      }
      return { count: 0 } as never;
    },
  } as unknown as typeof prisma.garante;
}

export function garanteRecapitoDb(_ctx: GarantiDbContext): typeof prisma.garanteRecapito {
  if (!isConnectorProvider()) return prisma.garanteRecapito;

  const r = repo(_ctx);
  return {
    count: async (args: Prisma.GaranteRecapitoCountArgs) => {
      const where = args.where as { garanteId?: string; tipo?: string } | undefined;
      return r.countRecapiti(String(where?.garanteId || ""), where?.tipo);
    },
    findFirst: async (args: Prisma.GaranteRecapitoFindFirstArgs) => {
      const where = args.where as { id?: string; garanteId?: string; tipo?: string } | undefined;
      const row = await r.findFirstRecapito(where ?? {});
      return row ? (applySelect(row, args.select) as never) : null;
    },
    create: async (args: Prisma.GaranteRecapitoCreateArgs) =>
      r.createRecapito(args.data as never) as never,
    update: async (args: Prisma.GaranteRecapitoUpdateArgs) => {
      const id = String((args.where as { id?: string })?.id || "");
      return r.updateRecapito(id, args.data as never) as never;
    },
    delete: async (args: Prisma.GaranteRecapitoDeleteArgs) => {
      const id = String((args.where as { id?: string })?.id || "");
      await r.deleteRecapito(id);
      return { id } as never;
    },
    deleteMany: async (args: Prisma.GaranteRecapitoDeleteManyArgs) => {
      const where = args.where as { garanteId?: string } | undefined;
      if (where?.garanteId) await r.deleteRecapitiByGarante(where.garanteId);
      return { count: 0 } as never;
    },
  } as unknown as typeof prisma.garanteRecapito;
}

export async function deleteGarantiByPratica(ctx: GarantiDbContext, praticaId: string) {
  return repo(ctx).deleteManyByPratica(ctx.tenantSlug, ctx.tenantId, praticaId);
}
