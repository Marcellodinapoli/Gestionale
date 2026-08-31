import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isConnectorProvider } from "@/lib/data/factory";
import { createConnectorSediRepository } from "@/lib/data/connector/ConnectorSediRepository";
import { prismaSediRepository } from "@/lib/data/prisma/PrismaSediRepository";
import type { SedeFilter, SediRepository } from "@/lib/data/contracts/sedi";
import { applySelect, mapSqlRow } from "@/lib/data/mapSqlRow";
import { resolveTenantSlug, type PraticaDbContext } from "@/lib/praticheRepo";
import type { SessionUser } from "@/lib/permissions";

export type SedeDbContext = Pick<PraticaDbContext, "tenantId" | "tenantSlug">;

function repo(ctx: SedeDbContext): SediRepository {
  if (isConnectorProvider()) return createConnectorSediRepository(ctx.tenantSlug);
  return prismaSediRepository;
}

export function sediRepoFromUser(user: SessionUser) {
  return sediDb({ tenantId: user.tenantId, tenantSlug: resolveTenantSlug(user) });
}

export const sediDbFromUser = sediRepoFromUser;

export function sediDb(ctx: SedeDbContext): typeof prisma.sede {
  if (!isConnectorProvider()) return prisma.sede;

  const r = repo(ctx);
  return {
    findMany: async (args: Prisma.SedeFindManyArgs) => {
      const orderBy = args.orderBy as Record<string, string> | undefined;
      const items = await r.list(ctx.tenantSlug, ctx.tenantId, {
        ...prismaWhereToFilter(args.where),
        orderBy: orderBy?.createdAt ? "createdAt" : "nome",
        orderDir: orderBy?.createdAt === "desc" || orderBy?.nome === "desc" ? "desc" : "asc",
        take: args.take ?? undefined,
        includeCounts: hasCounts(args.include),
      });
      return items.map((row) => applySelect(row, args.select)) as never[];
    },
    findFirst: async (args: Prisma.SedeFindFirstArgs) => {
      const orderBy = args.orderBy as Record<string, string> | undefined;
      const items = await r.list(ctx.tenantSlug, ctx.tenantId, {
        ...prismaWhereToFilter(args.where),
        orderBy: orderBy?.createdAt ? "createdAt" : "nome",
        orderDir: orderBy?.createdAt === "desc" || orderBy?.nome === "desc" ? "desc" : "asc",
        take: 1,
        includeCounts: hasCounts(args.include),
      });
      const row = items[0] ?? null;
      return row ? (applySelect(row, args.select) as never) : null;
    },
    findUnique: async (args: Prisma.SedeFindUniqueArgs) => {
      const where = args.where as {
        id?: string;
        tenantId_nome?: { tenantId: string; nome: string };
      };
      if (where?.tenantId_nome) {
        const row = await r.findByNome(
          ctx.tenantSlug,
          where.tenantId_nome.tenantId,
          where.tenantId_nome.nome
        );
        return row ? (applySelect(row, args.select) as never) : null;
      }
      if (where?.id) {
        const row = await r.getById(ctx.tenantSlug, ctx.tenantId, where.id);
        return row ? (applySelect(row, args.select) as never) : null;
      }
      return null;
    },
    count: async (args: Prisma.SedeCountArgs) =>
      r.count(ctx.tenantSlug, ctx.tenantId, prismaWhereToFilter(args.where)),
    create: async (args: Prisma.SedeCreateArgs) =>
      r.create(ctx.tenantSlug, args.data as never) as never,
    update: async (args: Prisma.SedeUpdateArgs) => {
      const id = String((args.where as { id?: string })?.id || "");
      return r.update(ctx.tenantSlug, ctx.tenantId, id, args.data as never) as never;
    },
  } as unknown as typeof prisma.sede;
}

function hasCounts(include: unknown) {
  if (!include || typeof include !== "object") return false;
  const inc = include as Record<string, unknown>;
  if (inc._count && typeof inc._count === "object") {
    const sel = (inc._count as { select?: Record<string, boolean> }).select;
    return Boolean(sel?.postazioni || sel?.users);
  }
  return false;
}

function prismaWhereToFilter(where: unknown): SedeFilter | undefined {
  if (!where) return undefined;
  const filter: SedeFilter = {};
  const walk = (w: unknown) => {
    if (!w || typeof w !== "object") return;
    const node = w as Record<string, unknown>;
    if (typeof node.tenantId === "string") filter.tenantId = node.tenantId;
    if (typeof node.id === "string") filter.id = node.id;
    if (node.id && typeof node.id === "object") {
      const idObj = node.id as Record<string, unknown>;
      if (Array.isArray(idObj.in)) filter.idsIn = idObj.in.map(String);
    }
    if (typeof node.nome === "string") filter.nome = node.nome;
    if (typeof node.active === "boolean") filter.active = node.active;
    if (node.NOT && typeof node.NOT === "object") {
      const not = node.NOT as Record<string, unknown>;
      if (typeof not.id === "string") filter.excludeId = not.id;
    }
    if (node.AND && Array.isArray(node.AND)) node.AND.forEach(walk);
    if (node.OR) walk(node.OR);
  };
  walk(where);
  return Object.keys(filter).length ? filter : undefined;
}

export { mapSqlRow };
