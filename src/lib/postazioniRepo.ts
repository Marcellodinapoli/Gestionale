import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isConnectorProvider } from "@/lib/data/factory";
import { createConnectorPostazioniRepository } from "@/lib/data/connector/ConnectorPostazioniRepository";
import { prismaPostazioniRepository } from "@/lib/data/prisma/PrismaPostazioniRepository";
import type { PostazioneFilter, PostazioniRepository } from "@/lib/data/contracts/postazioni";
import { applySelect, mapSqlRow } from "@/lib/data/mapSqlRow";
import { resolveTenantSlug, type PraticaDbContext } from "@/lib/praticheRepo";
import type { SessionUser } from "@/lib/permissions";

export type PostazioneDbContext = Pick<PraticaDbContext, "tenantId" | "tenantSlug">;

function repo(ctx: PostazioneDbContext): PostazioniRepository {
  if (isConnectorProvider()) return createConnectorPostazioniRepository(ctx.tenantSlug);
  return prismaPostazioniRepository;
}

export function postazioniDbFromUser(user: SessionUser) {
  return postazioniDb({ tenantId: user.tenantId, tenantSlug: resolveTenantSlug(user) });
}

export function postazioniDb(ctx: PostazioneDbContext): typeof prisma.postazione {
  if (!isConnectorProvider()) return prisma.postazione;

  const r = repo(ctx);
  return {
    findMany: async (args: Prisma.PostazioneFindManyArgs) => {
      const orderBy = parseOrderBy(args.orderBy);
      const inc = parseInclude(args.include);
      const items = await r.list(ctx.tenantSlug, ctx.tenantId, {
        ...prismaWhereToFilter(args.where),
        orderBy: orderBy.field,
        orderDir: orderBy.dir,
        take: args.take ?? undefined,
        includeSede: inc.sedeRef,
        includeOccupants: inc.occupanti,
        excludeOccupantUserId: inc.excludeOccupantUserId,
      });
      return items.map((row) => applyPostazioneShape(row, args.include, args.select)) as never[];
    },
    findFirst: async (args: Prisma.PostazioneFindFirstArgs) => {
      const orderBy = parseOrderBy(args.orderBy);
      const inc = parseInclude(args.include);
      const items = await r.list(ctx.tenantSlug, ctx.tenantId, {
        ...prismaWhereToFilter(args.where),
        orderBy: orderBy.field,
        orderDir: orderBy.dir,
        take: 1,
        includeSede: inc.sedeRef,
        includeOccupants: inc.occupanti,
        excludeOccupantUserId: inc.excludeOccupantUserId,
      });
      const row = items[0] ?? null;
      return row ? (applyPostazioneShape(row, args.include, args.select) as never) : null;
    },
    findUnique: async (args: Prisma.PostazioneFindUniqueArgs) => {
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
        return row ? (applyPostazioneShape(row, args.include, args.select) as never) : null;
      }
      if (where?.id) {
        const row = await r.getById(ctx.tenantSlug, ctx.tenantId, where.id);
        return row ? (applyPostazioneShape(row, args.include, args.select) as never) : null;
      }
      return null;
    },
    count: async (args: Prisma.PostazioneCountArgs) =>
      r.count(ctx.tenantSlug, ctx.tenantId, prismaWhereToFilter(args.where)),
    create: async (args: Prisma.PostazioneCreateArgs) =>
      r.create(ctx.tenantSlug, args.data as never) as never,
    update: async (args: Prisma.PostazioneUpdateArgs) => {
      const id = String((args.where as { id?: string })?.id || "");
      return r.update(ctx.tenantSlug, ctx.tenantId, id, args.data as never) as never;
    },
    delete: async (args: Prisma.PostazioneDeleteArgs) => {
      const id = String((args.where as { id?: string })?.id || "");
      await r.delete(ctx.tenantSlug, ctx.tenantId, id);
      return {} as never;
    },
  } as unknown as typeof prisma.postazione;
}

function parseOrderBy(orderBy: unknown): {
  field: "nome" | "createdAt" | "sedeNome";
  dir: "asc" | "desc";
} {
  if (Array.isArray(orderBy)) {
    for (const entry of orderBy) {
      if (entry && typeof entry === "object" && "sedeRef" in entry) {
        const sedeOrder = (entry as { sedeRef?: { nome?: string } }).sedeRef?.nome;
        return { field: "sedeNome", dir: sedeOrder === "desc" ? "desc" : "asc" };
      }
    }
    for (const entry of orderBy) {
      if (entry && typeof entry === "object" && "nome" in entry) {
        const nomeOrder = (entry as { nome?: string }).nome;
        return { field: "nome", dir: nomeOrder === "desc" ? "desc" : "asc" };
      }
    }
  }
  if (orderBy && typeof orderBy === "object") {
    const ob = orderBy as Record<string, string>;
    if (ob.createdAt) return { field: "createdAt", dir: ob.createdAt === "desc" ? "desc" : "asc" };
    if (ob.nome) return { field: "nome", dir: ob.nome === "desc" ? "desc" : "asc" };
  }
  return { field: "nome", dir: "asc" };
}

function parseInclude(include: unknown): {
  sedeRef: boolean;
  occupanti: boolean;
  excludeOccupantUserId?: string;
} {
  if (!include || typeof include !== "object") {
    return { sedeRef: false, occupanti: false };
  }
  const inc = include as Record<string, unknown>;
  let excludeOccupantUserId: string | undefined;
  if (inc.occupanti && typeof inc.occupanti === "object") {
    const occWhere = (inc.occupanti as { where?: Record<string, unknown> }).where;
    if (occWhere?.id && typeof occWhere.id === "object") {
      const notId = (occWhere.id as { not?: string }).not;
      if (notId) excludeOccupantUserId = String(notId);
    }
  }
  return {
    sedeRef: Boolean(inc.sedeRef),
    occupanti: Boolean(inc.occupanti),
    excludeOccupantUserId,
  };
}

function applyPostazioneShape(
  row: Record<string, unknown>,
  include: unknown,
  select: unknown
) {
  const shaped = { ...row };
  if (include && typeof include === "object") {
    const inc = include as Record<string, unknown>;
    if (!inc.sedeRef) delete shaped.sedeRef;
    else if (inc.sedeRef && typeof inc.sedeRef === "object") {
      const sel = (inc.sedeRef as { select?: Record<string, boolean> }).select;
      if (sel && shaped.sedeRef && typeof shaped.sedeRef === "object") {
        const sede = shaped.sedeRef as Record<string, unknown>;
        const out: Record<string, unknown> = {};
        for (const key of Object.keys(sel)) {
          if (sel[key]) out[key] = sede[key];
        }
        shaped.sedeRef = out;
      }
    }
    if (!inc.occupanti) delete shaped.occupanti;
    else if (inc.occupanti && typeof inc.occupanti === "object") {
      const sel = (inc.occupanti as { select?: Record<string, boolean> }).select;
      if (sel && Array.isArray(shaped.occupanti)) {
        shaped.occupanti = (shaped.occupanti as Record<string, unknown>[]).map((o) => {
          const out: Record<string, unknown> = {};
          for (const key of Object.keys(sel)) {
            if (sel[key]) out[key] = o[key];
          }
          return out;
        });
      }
    }
  }
  return applySelect(shaped, select);
}

function prismaWhereToFilter(where: unknown): PostazioneFilter | undefined {
  if (!where) return undefined;
  const filter: PostazioneFilter = {};
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
    if (typeof node.sedeId === "string") filter.sedeId = node.sedeId;
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
