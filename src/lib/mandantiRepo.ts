import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isConnectorProvider } from "@/lib/data/factory";
import { createConnectorMandantiRepository } from "@/lib/data/connector/ConnectorMandantiRepository";
import { prismaMandantiRepository } from "@/lib/data/prisma/PrismaMandantiRepository";
import type { MandanteFilter, MandanteListRequest, MandantiRepository } from "@/lib/data/contracts/mandanti";
import { applySelect, mapSqlRow } from "@/lib/data/mapSqlRow";
import { resolveTenantSlug, type PraticaDbContext } from "@/lib/praticheRepo";
import { resolveTenantSlugForConnector } from "@/lib/tenant";
import type { SessionUser } from "@/lib/permissions";

export type MandanteDbContext = Pick<PraticaDbContext, "tenantId" | "tenantSlug">;

async function connectorSlug(ctx: MandanteDbContext): Promise<string> {
  return resolveTenantSlugForConnector(ctx.tenantId, ctx.tenantSlug);
}

function repo(slug: string): MandantiRepository {
  if (isConnectorProvider()) return createConnectorMandantiRepository(slug);
  return prismaMandantiRepository;
}

export function mandantiDbFromUser(user: SessionUser) {
  return mandantiDb({ tenantId: user.tenantId, tenantSlug: resolveTenantSlug(user) });
}

export function mandantiDb(ctx: MandanteDbContext): typeof prisma.mandante {
  if (!isConnectorProvider()) return prisma.mandante;

  return {
    findMany: async (args: Prisma.MandanteFindManyArgs) => {
      const slug = await connectorSlug(ctx);
      const r = repo(slug);
      const result = await r.list({
        tenantSlug: slug,
        tenantId: ctx.tenantId,
        filter: prismaWhereToFilter(args.where),
        orderBy: prismaOrderByToSort(args.orderBy),
        skip: args.skip ?? undefined,
        take: args.take ?? undefined,
        includePraticaCount: hasPraticaCount(args.include),
      });
      return result.items.map((row) => applySelect(row, args.select)) as never[];
    },
    findFirst: async (args: Prisma.MandanteFindFirstArgs) => {
      const slug = await connectorSlug(ctx);
      const r = repo(slug);
      const items = await r.list({
        tenantSlug: slug,
        tenantId: ctx.tenantId,
        filter: prismaWhereToFilter(args.where),
        take: 1,
        includePraticaCount: hasPraticaCount(args.include),
      });
      const row = items.items[0] ?? null;
      return row ? (applySelect(row, args.select) as never) : null;
    },
    count: async (args: Prisma.MandanteCountArgs) => {
      const slug = await connectorSlug(ctx);
      return repo(slug).count(slug, ctx.tenantId, prismaWhereToFilter(args.where));
    },
    create: async (args: Prisma.MandanteCreateArgs) => {
      const slug = await connectorSlug(ctx);
      return repo(slug).create(slug, args.data as never) as never;
    },
    update: async (args: Prisma.MandanteUpdateArgs) => {
      const slug = await connectorSlug(ctx);
      const id = String((args.where as { id?: string })?.id || "");
      return repo(slug).update(slug, ctx.tenantId, id, args.data as never) as never;
    },
    delete: async (args: Prisma.MandanteDeleteArgs) => {
      const slug = await connectorSlug(ctx);
      const id = String((args.where as { id?: string })?.id || "");
      await repo(slug).delete(slug, ctx.tenantId, id);
      return { id } as never;
    },
  } as unknown as typeof prisma.mandante;
}

function hasPraticaCount(include: unknown) {
  if (!include || typeof include !== "object") return false;
  const inc = include as Record<string, unknown>;
  if (inc._count && typeof inc._count === "object") {
    return Boolean((inc._count as { select?: { pratiche?: boolean } }).select?.pratiche);
  }
  return false;
}

function prismaOrderByToSort(orderBy: unknown): MandanteListRequest["orderBy"] {
  if (!orderBy || typeof orderBy !== "object") return { codice: "asc" };
  const ob = orderBy as Record<string, string>;
  if (ob.codice) return { codice: ob.codice === "desc" ? "desc" : "asc" };
  if (ob.ragioneSociale) return { ragioneSociale: ob.ragioneSociale === "desc" ? "desc" : "asc" };
  return { codice: "asc" };
}

function prismaWhereToFilter(where: unknown): MandanteFilter | undefined {
  if (!where) return undefined;
  const filter: MandanteFilter = {};
  const walk = (w: unknown) => {
    if (!w || typeof w !== "object") return;
    const node = w as Record<string, unknown>;
    if (typeof node.tenantId === "string") filter.tenantId = node.tenantId;
    if (typeof node.id === "string") filter.ids = [node.id];
    if (node.id && typeof node.id === "object") {
      const idObj = node.id as Record<string, unknown>;
      if (Array.isArray(idObj.in)) filter.idsIn = idObj.in.map(String);
    }
    if (typeof node.codice === "string") filter.codice = node.codice;
    if (node.AND && Array.isArray(node.AND)) node.AND.forEach(walk);
    if (node.OR) walk(node.OR);
  };
  walk(where);
  return Object.keys(filter).length ? filter : undefined;
}

export { mapSqlRow };
