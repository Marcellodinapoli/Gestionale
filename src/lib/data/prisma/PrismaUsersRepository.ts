import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  UserCreateInput,
  UserFilter,
  UserInclude,
  UserListRequest,
  UserUpdateInput,
  UsersOperationalRepository,
} from "../contracts/users";

function buildWhere(tenantId: string, filter?: UserFilter): Prisma.UserWhereInput {
  const where: Prisma.UserWhereInput = { tenantId };
  if (!filter) return where;
  if (filter.id) where.id = filter.id;
  if (filter.idsIn?.length) where.id = { in: filter.idsIn };
  if (filter.email) where.email = filter.email;
  if (filter.active !== undefined) where.active = filter.active;
  if (filter.role) where.role = filter.role;
  if (filter.rolesIn?.length) where.role = { in: filter.rolesIn };
  if (filter.supervisorIdSet) where.supervisorId = filter.supervisorId ?? null;
  else if (filter.supervisorId) where.supervisorId = filter.supervisorId;
  if (filter.formazioneOnly !== undefined) where.formazioneOnly = filter.formazioneOnly;
  if (filter.sedeIdSet) where.sedeId = filter.sedeId ?? null;
  else if (filter.sedeId) where.sedeId = filter.sedeId;
  if (filter.postazioneIdSet) where.postazioneId = filter.postazioneId ?? null;
  else if (filter.postazioneId) where.postazioneId = filter.postazioneId;
  if (filter.excludeId) where.NOT = { ...(where.NOT as object), id: filter.excludeId };
  if (filter.excludeRole) where.NOT = { ...(where.NOT as object), role: filter.excludeRole };
  return where;
}

function buildInclude(include?: UserInclude): Prisma.UserInclude | undefined {
  if (!include) return undefined;
  const out: Prisma.UserInclude = {};
  if (include.sede) out.sede = { select: { id: true, nome: true } };
  if (include.postazione) {
    out.postazione = {
      select: {
        id: true,
        nome: true,
        interno: true,
        email: true,
        numeroFisso: true,
        sedeRef: { select: { nome: true } },
      },
    };
  }
  if (include.supervisor) out.supervisor = { select: { id: true, name: true } };
  if (include.passwordHistory) out.passwordHistory = { select: { passwordHash: true } };
  return Object.keys(out).length ? out : undefined;
}

export class PrismaUsersRepository implements UsersOperationalRepository {
  async list(_req: UserListRequest): Promise<{ items: import("../contracts/users").UserDto[]; total: number }> {
    throw new Error("use usersDb().findMany in firestore mode");
  }

  async count(_tenantSlug: string, tenantId: string, filter?: UserFilter) {
    return prisma.user.count({ where: buildWhere(tenantId, filter) });
  }

  async getById(
    _tenantSlug: string,
    tenantId: string,
    id: string,
    opts?: { include?: UserInclude; select?: Record<string, unknown> }
  ) {
    if (opts?.select) {
      return prisma.user.findFirst({
        where: { id, tenantId },
        select: opts.select as Prisma.UserSelect,
      }) as Promise<Record<string, unknown> | null>;
    }
    return prisma.user.findFirst({
      where: { id, tenantId },
      include: buildInclude(opts?.include),
    }) as Promise<Record<string, unknown> | null>;
  }

  async findByEmail(
    _tenantSlug: string,
    tenantId: string,
    email: string,
    opts?: { include?: UserInclude; select?: Record<string, unknown> }
  ) {
    if (opts?.select) {
      return prisma.user.findUnique({
        where: { tenantId_email: { tenantId, email: email.toLowerCase() } },
        select: opts.select as Prisma.UserSelect,
      }) as Promise<Record<string, unknown> | null>;
    }
    return prisma.user.findUnique({
      where: { tenantId_email: { tenantId, email: email.toLowerCase() } },
      include: buildInclude(opts?.include),
    }) as Promise<Record<string, unknown> | null>;
  }

  async create(_tenantSlug: string, data: UserCreateInput) {
    return prisma.user.create({
      data: data as unknown as Prisma.UserCreateInput,
    }) as Promise<Record<string, unknown>>;
  }

  async update(_tenantSlug: string, _tenantId: string, id: string, data: UserUpdateInput) {
    return prisma.user.update({
      where: { id },
      data: data as Prisma.UserUpdateInput,
    }) as Promise<Record<string, unknown>>;
  }

  async updateMany(
    _tenantSlug: string,
    tenantId: string,
    filter: UserFilter,
    data: UserUpdateInput
  ) {
    const result = await prisma.user.updateMany({
      where: buildWhere(tenantId, filter),
      data: data as Prisma.UserUpdateManyMutationInput,
    });
    return { count: result.count };
  }
}

export const prismaUsersRepository = new PrismaUsersRepository();
