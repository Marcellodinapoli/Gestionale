import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isConnectorProvider } from "@/lib/data/factory";
import { createConnectorProvvigioniRepository } from "@/lib/data/connector/ConnectorProvvigioniRepository";
import { prismaProvvigioniRepository } from "@/lib/data/prisma/PrismaProvvigioniRepository";
import type { ProvvigioneFilter, ProvvigioniRepository } from "@/lib/data/contracts/provvigioni";
import { applySelect, mapSqlRow } from "@/lib/data/mapSqlRow";
import { resolveTenantSlug, type PraticaDbContext } from "@/lib/praticheRepo";
import type { SessionUser } from "@/lib/permissions";

export type ProvvigioniDbContext = Pick<PraticaDbContext, "tenantId" | "tenantSlug">;

function repo(ctx: ProvvigioniDbContext): ProvvigioniRepository {
  if (isConnectorProvider()) return createConnectorProvvigioniRepository(ctx.tenantSlug);
  return prismaProvvigioniRepository;
}

export function provvigioniDbFromUser(user: SessionUser) {
  return provvigioniDb({ tenantId: user.tenantId, tenantSlug: resolveTenantSlug(user) });
}

export function provvigioniDb(ctx: ProvvigioniDbContext): typeof prisma.provvigione {
  if (!isConnectorProvider()) return prisma.provvigione;

  const r = repo(ctx);
  return {
    findMany: async (args: Prisma.ProvvigioneFindManyArgs) => {
      const filter = prismaWhereToFilter(args.where, ctx.tenantId);
      const result = await r.list({
        tenantSlug: ctx.tenantSlug,
        tenantId: ctx.tenantId,
        filter,
        skip: args.skip ?? undefined,
        take: args.take ?? undefined,
        orderBy: { createdAt: "desc" },
        includeOperatore: hasInclude(args.include, "operatore"),
        includePraticaDebitore: hasPraticaDebitoreInclude(args.include),
        includeIncasso: hasInclude(args.include, "incasso"),
      });
      return result.items.map((row) => mapFindManyRow(row, args)) as never[];
    },
    aggregate: async (args: Prisma.ProvvigioneAggregateArgs) => {
      const result = await r.aggregate({
        tenantSlug: ctx.tenantSlug,
        tenantId: ctx.tenantId,
        filter: prismaWhereToFilter(args.where, ctx.tenantId),
      });
      return {
        _sum: { importo: result._sum.importo },
        _count: result._count,
      } as never;
    },
    groupBy: async (args: Prisma.ProvvigioneGroupByArgs) => {
      const by = (args.by as string[]) ?? [];
      const rows = await r.groupBy({
        tenantSlug: ctx.tenantSlug,
        tenantId: ctx.tenantId,
        filter: prismaWhereToFilter(args.where, ctx.tenantId),
        by: by as ("operatoreId" | "stato")[],
      });
      return rows.map((row) => ({
        operatoreId: row.operatoreId,
        stato: row.stato,
        _sum: { importo: row._sum.importo },
        _count: row._count,
      })) as never;
    },
    update: async (args: Prisma.ProvvigioneUpdateArgs) => {
      const id = String((args.where as { id?: string })?.id || "");
      return r.update(ctx.tenantSlug, ctx.tenantId, id, args.data as never) as never;
    },
    updateMany: async (args: Prisma.ProvvigioneUpdateManyArgs) => {
      const filter = prismaWhereToFilter(args.where, ctx.tenantId) ?? {};
      const result = await r.updateMany(ctx.tenantSlug, ctx.tenantId, filter, args.data as never);
      return { count: result.count } as never;
    },
    deleteMany: async (args: Prisma.ProvvigioneDeleteManyArgs) => {
      const filter = prismaWhereToFilter(args.where, ctx.tenantId) ?? {};
      const result = await r.deleteMany(ctx.tenantSlug, ctx.tenantId, filter);
      return { count: result.count } as never;
    },
  } as unknown as typeof prisma.provvigione;
}

function hasInclude(include: unknown, key: string) {
  if (!include || typeof include !== "object") return false;
  return key in (include as Record<string, unknown>);
}

function hasPraticaDebitoreInclude(include: unknown) {
  if (!include || typeof include !== "object") return false;
  const pratica = (include as Record<string, unknown>).pratica;
  if (!pratica || typeof pratica !== "object") return false;
  return "debitore" in (pratica as Record<string, unknown>);
}

function mapFindManyRow(row: Record<string, unknown>, args: Prisma.ProvvigioneFindManyArgs) {
  const mapped = applySelect(row, args.select);
  if (args.include && typeof args.include === "object") {
    const inc = args.include as Record<string, unknown>;
    if ("operatore" in inc && row.operatore) {
      (mapped as Record<string, unknown>).operatore = applySelect(
        row.operatore as Record<string, unknown>,
        (inc.operatore as { select?: unknown })?.select
      );
    }
    if ("incasso" in inc && row.incasso) {
      (mapped as Record<string, unknown>).incasso = applySelect(
        row.incasso as Record<string, unknown>,
        (inc.incasso as { select?: unknown })?.select
      );
    }
    if ("pratica" in inc && row.pratica) {
      const prRow = row.pratica as Record<string, unknown>;
      const prInc = inc.pratica as Record<string, unknown>;
      const praticaMapped = applySelect(prRow, prInc.select);
      if (prInc.include && typeof prInc.include === "object" && "debitore" in prInc.include) {
        (praticaMapped as Record<string, unknown>).debitore = applySelect(
          prRow.debitore as Record<string, unknown>,
          (prInc.include as { debitore?: { select?: unknown } }).debitore?.select
        );
      }
      (mapped as Record<string, unknown>).pratica = praticaMapped;
    }
  }
  return mapped;
}

function prismaWhereToFilter(where: unknown, tenantId: string): ProvvigioneFilter | undefined {
  if (!where) return { tenantId };
  const filter: ProvvigioneFilter = { tenantId };
  const walk = (w: unknown, depth = 0) => {
    if (!w || typeof w !== "object") return;
    const node = w as Record<string, unknown>;

    if (node.id === "__nessun-dato__" || node.id === "__none__" || node.id === "__nessuno__") {
      filter.none = true;
    }
    if (typeof node.id === "string" && node.id !== "__nessun-dato__" && node.id !== "__none__") {
      filter.id = node.id;
    }
    if (node.operatoreId && typeof node.operatoreId === "string") filter.operatoreId = node.operatoreId;
    if (node.operatoreId && typeof node.operatoreId === "object") {
      const op = node.operatoreId as Record<string, unknown>;
      if (Array.isArray(op.in)) filter.operatoreIdIn = op.in.map(String);
    }
    if (typeof node.stato === "string") filter.stato = node.stato;
    if (typeof node.praticaId === "string") filter.praticaId = node.praticaId;
    if (node.createdAt && typeof node.createdAt === "object") {
      const d = node.createdAt as Record<string, unknown>;
      if (d.gte instanceof Date) filter.createdAtGte = d.gte.toISOString();
      if (d.lte instanceof Date) filter.createdAtLte = d.lte.toISOString();
    }
    if (node.operatore && typeof node.operatore === "object") {
      const op = node.operatore as Record<string, unknown>;
      if (typeof op.sedeId === "string") filter.operatoreSedeId = op.sedeId;
      if (op.OR && Array.isArray(op.OR)) {
        for (const orItem of op.OR) {
          if (orItem && typeof orItem === "object") {
            const o = orItem as Record<string, unknown>;
            if (typeof o.id === "string") filter.operatoreOrSupervisorId = o.id;
            if (typeof o.supervisorId === "string") filter.operatoreOrSupervisorId = o.supervisorId;
          }
        }
      }
    }
    if (node.pratica && typeof node.pratica === "object" && depth < 4) {
      const p = node.pratica as Record<string, unknown>;
      if (typeof p.tenantId === "string") filter.tenantId = p.tenantId;
      if (typeof p.mandanteId === "string") filter.praticaMandanteId = p.mandanteId;
      if (typeof p.numeroMandante === "string") filter.praticaNumeroMandante = p.numeroMandante;
      if (p.OR && Array.isArray(p.OR)) {
        const nullOr = p.OR.some(
          (x) =>
            x &&
            typeof x === "object" &&
            ((x as Record<string, unknown>).numeroMandante === null ||
              (x as Record<string, unknown>).numeroMandante === "")
        );
        if (nullOr) filter.praticaNumeroMandanteNull = true;
        const perimetroOr: NonNullable<ProvvigioneFilter["perimetroOr"]> = [];
        for (const clause of p.OR) {
          if (!clause || typeof clause !== "object") continue;
          const c = clause as Record<string, unknown>;
          const mandanteId = typeof c.mandanteId === "string" ? c.mandanteId : "";
          if (!mandanteId) continue;
          const nm = c.numeroMandante as { in?: string[] } | undefined;
          perimetroOr.push({
            mandanteId,
            numeriMandante: nm?.in?.map(String),
          });
        }
        if (perimetroOr.length) filter.perimetroOr = perimetroOr;
      }
      walk(p, depth + 1);
    }
    if (node.AND && Array.isArray(node.AND)) node.AND.forEach((x) => walk(x, depth + 1));
    if (node.OR && Array.isArray(node.OR) && depth === 0) node.OR.forEach((x) => walk(x, depth + 1));
  };
  walk(where);
  return filter;
}

export { mapSqlRow };
