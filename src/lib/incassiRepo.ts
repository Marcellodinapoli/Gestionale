import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isConnectorProvider } from "@/lib/data/factory";
import { createConnectorIncassiRepository } from "@/lib/data/connector/ConnectorIncassiRepository";
import { prismaIncassiRepository } from "@/lib/data/prisma/PrismaIncassiRepository";
import type {
  IncassoFilter,
  IncassiRepository,
  RegistraIncassoInput,
} from "@/lib/data/contracts/incassi";
import { applySelect, mapSqlRow } from "@/lib/data/mapSqlRow";
import { resolveTenantSlug, type PraticaDbContext } from "@/lib/praticheRepo";
import type { SessionUser } from "@/lib/permissions";

export type IncassoDbContext = Pick<PraticaDbContext, "tenantId" | "tenantSlug">;

function repo(ctx: IncassoDbContext): IncassiRepository {
  if (isConnectorProvider()) return createConnectorIncassiRepository(ctx.tenantSlug);
  return prismaIncassiRepository;
}

export function incassiDbFromUser(user: SessionUser) {
  return incassiDb({ tenantId: user.tenantId, tenantSlug: resolveTenantSlug(user) });
}

export function incassiDb(ctx: IncassoDbContext): typeof prisma.incasso {
  if (!isConnectorProvider()) return prisma.incasso;

  const r = repo(ctx);
  return {
    findMany: async (args: Prisma.IncassoFindManyArgs) => {
      const filter = prismaWhereToFilter(args.where, ctx.tenantId);
      const result = await r.list({
        tenantSlug: ctx.tenantSlug,
        tenantId: ctx.tenantId,
        filter,
        skip: args.skip ?? undefined,
        take: args.take ?? undefined,
        includePratica: hasPraticaInclude(args.include),
      });
      return result.items.map((row) => mapFindManyRow(row, args)) as never[];
    },
    count: async (args: Prisma.IncassoCountArgs) =>
      r.count(ctx.tenantSlug, ctx.tenantId, prismaWhereToFilter(args.where, ctx.tenantId)),
    aggregate: async (args: Prisma.IncassoAggregateArgs) =>
      r.aggregate({
        tenantSlug: ctx.tenantSlug,
        tenantId: ctx.tenantId,
        filter: prismaWhereToFilter(args.where, ctx.tenantId),
      }) as never,
    groupBy: async (args: Prisma.IncassoGroupByArgs) => {
      const by = args.by as string[] | undefined;
      if (!by?.includes("metodo")) {
        throw new Error("incassiDb.groupBy: solo by metodo supportato in connector mode");
      }
      return r.groupByMetodo({
        tenantSlug: ctx.tenantSlug,
        tenantId: ctx.tenantId,
        filter: prismaWhereToFilter(args.where, ctx.tenantId),
      }) as never;
    },
    create: async (args: Prisma.IncassoCreateArgs) => {
      const data = args.data as Record<string, unknown>;
      return r.create(ctx.tenantSlug, ctx.tenantId, {
        praticaId: String(data.praticaId),
        userId: String(data.userId),
        importo: Number(data.importo),
        capitale: data.capitale != null ? Number(data.capitale) : undefined,
        interessi: data.interessi != null ? Number(data.interessi) : undefined,
        spese: data.spese != null ? Number(data.spese) : undefined,
        speseRec: data.speseRec != null ? Number(data.speseRec) : undefined,
        metodo: data.metodo != null ? String(data.metodo) : undefined,
        modo: data.modo != null ? String(data.modo) : undefined,
        causale: data.causale != null ? String(data.causale) : undefined,
        data: data.data as Date | string | undefined,
        dataScadenza: data.dataScadenza as Date | string | null | undefined,
      }) as never;
    },
  } as unknown as typeof prisma.incasso;
}

export async function registraIncassoWithSideEffects(
  ctx: IncassoDbContext,
  input: RegistraIncassoInput
) {
  return repo(ctx).registra(ctx.tenantSlug, ctx.tenantId, input);
}

function hasPraticaInclude(include: unknown) {
  if (!include || typeof include !== "object") return false;
  return "pratica" in (include as Record<string, unknown>);
}

function mapFindManyRow(row: Record<string, unknown>, args: Prisma.IncassoFindManyArgs) {
  const mapped = applySelect(row, args.select);
  if (args.include && typeof args.include === "object" && "pratica" in args.include) {
    const praticaRow = row.pratica as Record<string, unknown> | undefined;
    if (praticaRow) {
      (mapped as Record<string, unknown>).pratica = mapSqlRow(praticaRow);
    }
  }
  return mapped;
}

function prismaWhereToFilter(where: unknown, tenantId: string): IncassoFilter | undefined {
  if (!where) return { tenantId };
  const filter: IncassoFilter = { tenantId };
  const walk = (w: unknown, depth = 0) => {
    if (!w || typeof w !== "object") return;
    const node = w as Record<string, unknown>;

    if (node.id === "__none__" || node.id === "__nessun-dato__") {
      filter.none = true;
    }
    if (typeof node.praticaId === "string") filter.praticaId = node.praticaId;
    if (node.praticaId && typeof node.praticaId === "object") {
      const pid = node.praticaId as Record<string, unknown>;
      if (Array.isArray(pid.in)) filter.praticaIdsIn = pid.in.map(String);
    }
    if (typeof node.userId === "string") filter.userId = node.userId;
    if (node.data && typeof node.data === "object") {
      const d = node.data as Record<string, unknown>;
      if (d.gte instanceof Date) filter.dataGte = d.gte.toISOString();
      else if (typeof d.gte === "string") filter.dataGte = d.gte;
      if (d.lte instanceof Date) filter.dataLte = d.lte.toISOString();
      else if (typeof d.lte === "string") filter.dataLte = d.lte;
    }
    if (node.pratica && typeof node.pratica === "object") {
      const p = node.pratica as Record<string, unknown>;
      if (typeof p.tenantId === "string") filter.tenantId = p.tenantId;
      if (typeof p.mandanteId === "string") filter.mandanteId = p.mandanteId;
      if (typeof p.numeroMandante === "string") filter.numeroMandante = p.numeroMandante;
      if (p.OR && Array.isArray(p.OR)) {
        for (const orItem of p.OR) {
          if (orItem && typeof orItem === "object") {
            const o = orItem as Record<string, unknown>;
            const assegn = o.assegnatario as Record<string, unknown> | undefined;
            const tit = o.operatoreTitolare as Record<string, unknown> | undefined;
            if (typeof assegn?.sedeId === "string") filter.sedeId = assegn.sedeId;
            if (typeof tit?.sedeId === "string") filter.sedeId = tit.sedeId;
          }
        }
      }
      if (depth < 4) walk(p, depth + 1);
    }
    if (node.AND && Array.isArray(node.AND)) node.AND.forEach((x) => walk(x, depth + 1));
    if (node.OR && !filter.sedeId) {
      // top-level OR without pratica nesting
    }
  };
  walk(where);
  return filter;
}

export { mapSqlRow };
