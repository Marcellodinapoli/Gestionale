import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isConnectorProvider } from "@/lib/data/factory";
import { createConnectorDebitoriRepository } from "@/lib/data/connector/ConnectorDebitoriRepository";
import { prismaDebitoriRepository } from "@/lib/data/prisma/PrismaDebitoriRepository";
import type { DebitoreFilter, DebitoriRepository } from "@/lib/data/contracts/debitori";
import { applySelect, mapSqlRow } from "@/lib/data/mapSqlRow";
import { resolveTenantSlug, type PraticaDbContext } from "@/lib/praticheRepo";
import type { SessionUser } from "@/lib/permissions";

export type DebitoreDbContext = Pick<PraticaDbContext, "tenantId" | "tenantSlug">;

function repo(ctx: DebitoreDbContext): DebitoriRepository {
  if (isConnectorProvider()) return createConnectorDebitoriRepository(ctx.tenantSlug);
  return prismaDebitoriRepository;
}

export function debitoriDbFromUser(user: SessionUser) {
  return debitoriDb({ tenantId: user.tenantId, tenantSlug: resolveTenantSlug(user) });
}

export function debitoriDb(ctx: DebitoreDbContext): typeof prisma.debitore {
  if (!isConnectorProvider()) return prisma.debitore;

  const r = repo(ctx);
  return {
    findMany: async (args: Prisma.DebitoreFindManyArgs) => {
      const result = await r.list({
        tenantSlug: ctx.tenantSlug,
        tenantId: ctx.tenantId,
        filter: prismaWhereToFilter(args.where),
        skip: args.skip ?? undefined,
        take: args.take ?? undefined,
      });
      return result.items.map((row) => applySelect(row, args.select)) as never[];
    },
    findFirst: async (args: Prisma.DebitoreFindFirstArgs) => {
      const items = await r.list({
        tenantSlug: ctx.tenantSlug,
        tenantId: ctx.tenantId,
        filter: prismaWhereToFilter(args.where),
        take: 1,
      });
      const row = items.items[0] ?? null;
      return row ? (applySelect(row, args.select) as never) : null;
    },
    update: async (args: Prisma.DebitoreUpdateArgs) => {
      const id = String((args.where as { id?: string })?.id || "");
      return r.update(ctx.tenantSlug, ctx.tenantId, id, args.data as never) as never;
    },
    create: async (args: Prisma.DebitoreCreateArgs) =>
      r.create(ctx.tenantSlug, args.data as never) as never,
    delete: async (args: Prisma.DebitoreDeleteArgs) => {
      const id = String((args.where as { id?: string })?.id || "");
      await r.delete(ctx.tenantSlug, ctx.tenantId, id);
      return { id } as never;
    },
  } as unknown as typeof prisma.debitore;
}

export function debitoreRecapitoDb(_ctx: DebitoreDbContext): typeof prisma.debitoreRecapito {
  if (!isConnectorProvider()) return prisma.debitoreRecapito;

  const r = repo(_ctx);
  return {
    count: async (args: Prisma.DebitoreRecapitoCountArgs) => {
      const where = args.where as { debitoreId?: string; tipo?: string } | undefined;
      return r.countRecapiti(String(where?.debitoreId || ""), where?.tipo);
    },
    findFirst: async (args: Prisma.DebitoreRecapitoFindFirstArgs) => {
      const where = args.where as { id?: string; debitoreId?: string; tipo?: string } | undefined;
      const row = await r.findFirstRecapito(where ?? {});
      return row ? (applySelect(row, args.select) as never) : null;
    },
    create: async (args: Prisma.DebitoreRecapitoCreateArgs) =>
      r.createRecapito(args.data as never) as never,
    update: async (args: Prisma.DebitoreRecapitoUpdateArgs) => {
      const id = String((args.where as { id?: string })?.id || "");
      return r.updateRecapito(id, args.data as never) as never;
    },
    delete: async (args: Prisma.DebitoreRecapitoDeleteArgs) => {
      const id = String((args.where as { id?: string })?.id || "");
      await r.deleteRecapito(id);
      return { id } as never;
    },
    deleteMany: async (args: Prisma.DebitoreRecapitoDeleteManyArgs) => {
      const where = args.where as { debitoreId?: string } | undefined;
      if (where?.debitoreId) await r.deleteRecapitiByDebitore(where.debitoreId);
      return { count: 0 } as never;
    },
  } as unknown as typeof prisma.debitoreRecapito;
}

export async function debitoreIdsByCfVariants(
  ctx: DebitoreDbContext,
  tenantId: string,
  variants: string[]
) {
  return repo(ctx).idsByCf(ctx.tenantSlug, tenantId, variants);
}

function prismaWhereToFilter(where: unknown): DebitoreFilter | undefined {
  if (!where) return undefined;
  const filter: DebitoreFilter = {};
  const walk = (w: unknown) => {
    if (!w || typeof w !== "object") return;
    const node = w as Record<string, unknown>;
    if (typeof node.tenantId === "string") filter.tenantId = node.tenantId;
    if (typeof node.id === "string") filter.ids = [node.id];
    if (node.codiceFiscale && typeof node.codiceFiscale === "object") {
      const cf = node.codiceFiscale as Record<string, unknown>;
      if (Array.isArray(cf.in)) filter.codiceFiscaleIn = cf.in.map(String);
    }
    if (node.AND && Array.isArray(node.AND)) node.AND.forEach(walk);
  };
  walk(where);
  return Object.keys(filter).length ? filter : undefined;
}

export { mapSqlRow };
