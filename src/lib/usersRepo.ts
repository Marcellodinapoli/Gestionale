import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isConnectorProvider } from "@/lib/data/factory";
import { createConnectorUsersAdminRepository } from "@/lib/data/connector/ConnectorUsersAdminRepository";
import { prismaUsersRepository } from "@/lib/data/prisma/PrismaUsersRepository";
import type { UserFilter, UserInclude, UserOrderBy, UsersOperationalRepository } from "@/lib/data/contracts/users";
import { applySelect } from "@/lib/data/mapSqlRow";
import { resolveTenantSlug, type PraticaDbContext } from "@/lib/praticheRepo";
import { resolveTenantSlugForConnector } from "@/lib/tenant";
import type { SessionUser } from "@/lib/permissions";

export type UserDbContext = Pick<PraticaDbContext, "tenantId" | "tenantSlug">;

const USER_DATE_FIELDS = ["lastLoginAt", "lastLogoutAt", "passwordChangedAt", "createdAt"] as const;

function normalizeUserRow(row: Record<string, unknown>) {
  for (const key of USER_DATE_FIELDS) {
    const val = row[key];
    if (typeof val === "string") row[key] = new Date(val);
  }
  return row;
}

function mapUserRow(row: Record<string, unknown>, select: unknown) {
  return applySelect(normalizeUserRow(row), select);
}

async function connectorSlug(ctx: UserDbContext): Promise<string> {
  return resolveTenantSlugForConnector(ctx.tenantId, ctx.tenantSlug);
}

function repo(slug: string): UsersOperationalRepository {
  if (isConnectorProvider()) return createConnectorUsersAdminRepository(slug);
  return prismaUsersRepository;
}

export function usersDbFromUser(user: SessionUser) {
  return usersDb({ tenantId: user.tenantId, tenantSlug: resolveTenantSlug(user) });
}

export function usersDb(ctx: UserDbContext): typeof prisma.user {
  if (!isConnectorProvider()) return prisma.user;

  return {
    findMany: async (args: Prisma.UserFindManyArgs) => {
      const slug = await connectorSlug(ctx);
      const r = repo(slug);
      const result = await r.list({
        tenantSlug: slug,
        tenantId: ctx.tenantId,
        filter: prismaWhereToFilter(args.where),
        orderBy: prismaOrderByToSort(args.orderBy),
        skip: args.skip ?? undefined,
        take: args.take ?? undefined,
        include: prismaIncludeToUserInclude(args.include),
        select: args.select as Record<string, unknown> | undefined,
      });
      return result.items.map((row) => mapUserRow(row, args.select ?? args.include)) as never[];
    },
    findFirst: async (args: Prisma.UserFindFirstArgs) => {
      const slug = await connectorSlug(ctx);
      const r = repo(slug);
      const items = await r.list({
        tenantSlug: slug,
        tenantId: ctx.tenantId,
        filter: prismaWhereToFilter(args.where),
        orderBy: prismaOrderByToSort(args.orderBy),
        take: 1,
        include: prismaIncludeToUserInclude(args.include),
        select: args.select as Record<string, unknown> | undefined,
      });
      const row = items.items[0] ?? null;
      return row ? (mapUserRow(row, args.select ?? args.include) as never) : null;
    },
    findUnique: async (args: Prisma.UserFindUniqueArgs) => {
      const slug = await connectorSlug(ctx);
      const r = repo(slug);
      const where = args.where as {
        id?: string;
        tenantId_email?: { tenantId: string; email: string };
      };
      if (where?.tenantId_email) {
        const row = await r.findByEmail(
          slug,
          where.tenantId_email.tenantId,
          where.tenantId_email.email,
          {
            include: prismaIncludeToUserInclude(args.include),
            select: args.select as Record<string, unknown> | undefined,
          }
        );
        return row ? (mapUserRow(row, args.select ?? args.include) as never) : null;
      }
      if (where?.id) {
        const row = await r.getById(slug, ctx.tenantId, where.id, {
          include: prismaIncludeToUserInclude(args.include),
          select: args.select as Record<string, unknown> | undefined,
        });
        return row ? (mapUserRow(row, args.select ?? args.include) as never) : null;
      }
      return null;
    },
    count: async (args: Prisma.UserCountArgs) => {
      const slug = await connectorSlug(ctx);
      return repo(slug).count(slug, ctx.tenantId, prismaWhereToFilter(args.where));
    },
    create: async (args: Prisma.UserCreateArgs) => {
      const slug = await connectorSlug(ctx);
      return repo(slug).create(slug, args.data as never) as never;
    },
    update: async (args: Prisma.UserUpdateArgs) => {
      const slug = await connectorSlug(ctx);
      const id = String((args.where as { id?: string })?.id || "");
      return repo(slug).update(slug, ctx.tenantId, id, args.data as never) as never;
    },
    updateMany: async (args: Prisma.UserUpdateManyArgs) => {
      const slug = await connectorSlug(ctx);
      return repo(slug).updateMany(
        slug,
        ctx.tenantId,
        prismaWhereToFilter(args.where) ?? {},
        args.data as never
      );
    },
  } as unknown as typeof prisma.user;
}

function prismaIncludeToUserInclude(include: unknown): UserInclude | undefined {
  if (!include || typeof include !== "object") return undefined;
  const inc = include as Record<string, unknown>;
  const out: UserInclude = {};
  if (inc.sede) out.sede = true;
  if (inc.postazione) out.postazione = true;
  if (inc.supervisor) out.supervisor = true;
  if (inc.passwordHistory) out.passwordHistory = true;
  return Object.keys(out).length ? out : undefined;
}

function prismaOrderByToSort(orderBy: unknown): UserOrderBy {
  if (!orderBy) return { name: "asc" };
  const items = Array.isArray(orderBy) ? orderBy : [orderBy];
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const ob = item as Record<string, string>;
    if (ob.name) return { name: ob.name === "desc" ? "desc" : "asc" };
    if (ob.email) return { email: ob.email === "desc" ? "desc" : "asc" };
    if (ob.role) return { role: ob.role === "desc" ? "desc" : "asc" };
    if (ob.createdAt) return { createdAt: ob.createdAt === "desc" ? "desc" : "asc" };
    if (ob.lastLoginAt) return { lastLoginAt: ob.lastLoginAt === "desc" ? "desc" : "asc" };
  }
  return { name: "asc" };
}

function prismaWhereToFilter(where: unknown): UserFilter | undefined {
  if (!where) return undefined;
  const filter: UserFilter = {};
  const walk = (w: unknown) => {
    if (!w || typeof w !== "object") return;
    const node = w as Record<string, unknown>;
    if (typeof node.tenantId === "string") filter.tenantId = node.tenantId;
    if (typeof node.id === "string") filter.id = node.id;
    if (node.id && typeof node.id === "object") {
      const idObj = node.id as Record<string, unknown>;
      if (Array.isArray(idObj.in)) filter.idsIn = idObj.in.map(String);
    }
    if (typeof node.email === "string") filter.email = node.email;
    if (typeof node.active === "boolean") filter.active = node.active;
    if (typeof node.role === "string") filter.role = node.role;
    if (node.role && typeof node.role === "object") {
      const roleObj = node.role as Record<string, unknown>;
      if (Array.isArray(roleObj.in)) filter.rolesIn = roleObj.in.map(String);
    }
    if (node.supervisorId === null) {
      filter.supervisorIdSet = true;
      filter.supervisorId = null;
    } else if (typeof node.supervisorId === "string") {
      filter.supervisorId = node.supervisorId;
    }
    if (typeof node.formazioneOnly === "boolean") filter.formazioneOnly = node.formazioneOnly;
    if (node.sedeId === null) {
      filter.sedeIdSet = true;
      filter.sedeId = null;
    } else if (typeof node.sedeId === "string") {
      filter.sedeId = node.sedeId;
    }
    if (node.postazioneId === null) {
      filter.postazioneIdSet = true;
      filter.postazioneId = null;
    } else if (typeof node.postazioneId === "string") {
      filter.postazioneId = node.postazioneId;
    }
    if (node.id && typeof node.id === "object") {
      const idObj = node.id as Record<string, unknown>;
      if (typeof idObj.not === "string") filter.excludeId = idObj.not;
    }
    if (node.role && typeof node.role === "object") {
      const roleObj = node.role as Record<string, unknown>;
      if (typeof roleObj.not === "string") filter.excludeRole = roleObj.not;
    }
    if (node.AND && Array.isArray(node.AND)) node.AND.forEach(walk);
    if (node.OR) walk(node.OR);
  };
  walk(where);
  return Object.keys(filter).length ? filter : undefined;
}
