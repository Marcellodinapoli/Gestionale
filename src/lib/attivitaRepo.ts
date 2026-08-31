import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isConnectorProvider } from "@/lib/data/factory";
import { createConnectorAttivitaRepository } from "@/lib/data/connector/ConnectorAttivitaRepository";
import { prismaAttivitaRepository } from "@/lib/data/prisma/PrismaAttivitaRepository";
import type { AttivitaFilter, AttivitaRepository } from "@/lib/data/contracts/attivita";
import { applySelect, mapSqlRow } from "@/lib/data/mapSqlRow";
import { resolveTenantSlug, type PraticaDbContext } from "@/lib/praticheRepo";
import type { SessionUser } from "@/lib/permissions";

export type AttivitaDbContext = Pick<PraticaDbContext, "tenantId" | "tenantSlug">;

function repo(ctx: AttivitaDbContext): AttivitaRepository {
  if (isConnectorProvider()) return createConnectorAttivitaRepository(ctx.tenantSlug);
  return prismaAttivitaRepository;
}

export function attivitaDbFromUser(user: SessionUser) {
  return attivitaDb({ tenantId: user.tenantId, tenantSlug: resolveTenantSlug(user) });
}

export function attivitaDb(ctx: AttivitaDbContext): typeof prisma.attivita {
  if (!isConnectorProvider()) return prisma.attivita;

  const r = repo(ctx);
  return {
    findMany: async (args: Prisma.AttivitaFindManyArgs) => {
      const filter = prismaWhereToFilter(args.where, ctx.tenantId);
      const orderBy = args.orderBy as { createdAt?: string } | undefined;
      const result = await r.list({
        tenantSlug: ctx.tenantSlug,
        tenantId: ctx.tenantId,
        filter,
        skip: args.skip ?? undefined,
        take: args.take ?? undefined,
        orderBy: orderBy?.createdAt
          ? { createdAt: orderBy.createdAt === "asc" ? "asc" : "desc" }
          : undefined,
        includeUser: hasUserInclude(args.include),
      });
      return result.items.map((row) => mapFindManyRow(row, args)) as never[];
    },
    findUnique: async (args: Prisma.AttivitaFindUniqueArgs) => {
      const id = String((args.where as { id?: string })?.id || "");
      const row = await r.getById(ctx.tenantSlug, ctx.tenantId, id);
      return row ? (applySelect(row, args.select) as never) : null;
    },
    create: async (args: Prisma.AttivitaCreateArgs) => {
      const data = args.data as Record<string, unknown>;
      return r.create(ctx.tenantSlug, ctx.tenantId, {
        praticaId: String(data.praticaId),
        userId: String(data.userId),
        tipo: String(data.tipo),
        esito: data.esito != null ? String(data.esito) : null,
        nota: data.nota != null ? String(data.nota) : null,
        scheduledAt: data.scheduledAt as Date | string | null | undefined,
        fissata: Boolean(data.fissata),
        importante: Boolean(data.importante),
        bloccata: Boolean(data.bloccata),
      }) as never;
    },
    update: async (args: Prisma.AttivitaUpdateArgs) => {
      const id = String((args.where as { id?: string })?.id || "");
      return r.update(ctx.tenantSlug, ctx.tenantId, id, args.data as never) as never;
    },
    updateMany: async (args: Prisma.AttivitaUpdateManyArgs) =>
      r.updateMany(
        ctx.tenantSlug,
        ctx.tenantId,
        prismaWhereToFilter(args.where, ctx.tenantId) ?? {},
        args.data as never
      ) as never,
    deleteMany: async (args: Prisma.AttivitaDeleteManyArgs) =>
      r.deleteMany(
        ctx.tenantSlug,
        ctx.tenantId,
        prismaWhereToFilter(args.where, ctx.tenantId) ?? {}
      ) as never,
    groupBy: async (args: Prisma.AttivitaGroupByArgs) => {
      const by = args.by as string[] | undefined;
      if (!by?.includes("userId")) {
        throw new Error("attivitaDb.groupBy: solo by userId supportato in connector mode");
      }
      return r.groupByUserId(
        ctx.tenantSlug,
        ctx.tenantId,
        prismaWhereToFilter(args.where, ctx.tenantId)
      ) as never;
    },
  } as unknown as typeof prisma.attivita;
}

export async function toggleFissaAttivita(
  ctx: AttivitaDbContext,
  attivitaId: string,
  praticaId: string,
  fissata: boolean
) {
  return repo(ctx).toggleFissa(ctx.tenantSlug, ctx.tenantId, attivitaId, praticaId, fissata);
}

function hasUserInclude(include: unknown) {
  if (!include || typeof include !== "object") return false;
  return "user" in (include as Record<string, unknown>);
}

function mapFindManyRow(row: Record<string, unknown>, args: Prisma.AttivitaFindManyArgs) {
  const mapped = applySelect(row, args.select);
  if (args.include && typeof args.include === "object" && "user" in args.include) {
    const userRow = row.user as Record<string, unknown> | undefined;
    if (userRow) {
      (mapped as Record<string, unknown>).user = mapSqlRow(userRow);
    }
  }
  return mapped;
}

function prismaWhereToFilter(where: unknown, tenantId: string): AttivitaFilter | undefined {
  if (!where) return { tenantId };
  const filter: AttivitaFilter = { tenantId };
  const walk = (w: unknown, depth = 0) => {
    if (!w || typeof w !== "object") return;
    const node = w as Record<string, unknown>;

    if (node.id === "__none__") filter.none = true;
    if (typeof node.praticaId === "string") filter.praticaId = node.praticaId;
    if (node.praticaId && typeof node.praticaId === "object") {
      const pid = node.praticaId as Record<string, unknown>;
      if (Array.isArray(pid.in)) filter.praticaIdsIn = pid.in.map(String);
    }
    if (typeof node.userId === "string") filter.userId = node.userId;
    if (typeof node.tipo === "string") filter.tipo = node.tipo;
    if (node.fissata === true) filter.fissata = true;
    if (node.fissata === false) filter.fissata = false;
    if (node.createdAt && typeof node.createdAt === "object") {
      const d = node.createdAt as Record<string, unknown>;
      if (d.gte instanceof Date) filter.createdAtGte = d.gte.toISOString();
      if (d.lte instanceof Date) filter.createdAtLte = d.lte.toISOString();
    }
    if (node.user && typeof node.user === "object") {
      const u = node.user as Record<string, unknown>;
      if (u.role && typeof u.role === "object") {
        const role = u.role as Record<string, unknown>;
        if (Array.isArray(role.in)) filter.userRoleIn = role.in.map(String);
      }
    }
    if (node.pratica && typeof node.pratica === "object" && depth < 3) {
      walk(node.pratica, depth + 1);
    }
    if (node.AND && Array.isArray(node.AND)) node.AND.forEach((x) => walk(x, depth + 1));
  };
  walk(where);
  return filter;
}

export { mapSqlRow };
