import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  AttivitaCreateInput,
  AttivitaFilter,
  AttivitaListRequest,
  AttivitaRepository,
  AttivitaUpdateInput,
} from "../contracts/attivita";

export class PrismaAttivitaRepository implements AttivitaRepository {
  async list(_req: AttivitaListRequest): Promise<{ items: Record<string, unknown>[]; total: number }> {
    throw new Error("use attivitaDb() in firestore mode");
  }

  async count(_tenantSlug: string, _tenantId: string, filter?: AttivitaFilter): Promise<number> {
    return prisma.attivita.count({ where: filterToPrismaWhere(filter) as Prisma.AttivitaWhereInput });
  }

  async groupByUserId(_tenantSlug: string, _tenantId: string, filter?: AttivitaFilter) {
    const rows = await prisma.attivita.groupBy({
      by: ["userId"],
      where: filterToPrismaWhere(filter) as Prisma.AttivitaWhereInput,
      _count: true,
    });
    return rows.map((r) => ({
      userId: r.userId,
      _count: typeof r._count === "number" ? r._count : 0,
    }));
  }

  async getById(_tenantSlug: string, _tenantId: string, id: string) {
    return prisma.attivita.findUnique({ where: { id } }) as Promise<Record<string, unknown> | null>;
  }

  async create(_tenantSlug: string, _tenantId: string, data: AttivitaCreateInput) {
    return prisma.attivita.create({
      data: data as unknown as Prisma.AttivitaCreateInput,
    }) as Promise<Record<string, unknown>>;
  }

  async update(_tenantSlug: string, _tenantId: string, id: string, data: AttivitaUpdateInput) {
    return prisma.attivita.update({
      where: { id },
      data: data as Prisma.AttivitaUpdateInput,
    }) as Promise<Record<string, unknown>>;
  }

  async updateMany(
    _tenantSlug: string,
    _tenantId: string,
    filter: AttivitaFilter,
    data: AttivitaUpdateInput
  ) {
    const result = await prisma.attivita.updateMany({
      where: filterToPrismaWhere(filter) as Prisma.AttivitaWhereInput,
      data: data as Prisma.AttivitaUpdateManyMutationInput,
    });
    return { count: result.count };
  }

  async deleteMany(_tenantSlug: string, _tenantId: string, filter: AttivitaFilter) {
    const result = await prisma.attivita.deleteMany({
      where: filterToPrismaWhere(filter) as Prisma.AttivitaWhereInput,
    });
    return { count: result.count };
  }

  async toggleFissa(
    _tenantSlug: string,
    _tenantId: string,
    attivitaId: string,
    praticaId: string,
    fissata: boolean
  ) {
    await prisma.$transaction([
      prisma.attivita.updateMany({
        where: { praticaId, fissata: true },
        data: { fissata: false },
      }),
      ...(fissata
        ? [
            prisma.attivita.update({
              where: { id: attivitaId },
              data: { fissata: true },
            }),
          ]
        : []),
    ]);
  }
}

function filterToPrismaWhere(filter?: AttivitaFilter): Record<string, unknown> {
  if (!filter) return {};
  if (filter.none) return { id: "__none__" };
  const where: Record<string, unknown> = {};
  if (filter.praticaId) where.praticaId = filter.praticaId;
  if (filter.praticaIdsIn?.length) where.praticaId = { in: filter.praticaIdsIn };
  if (filter.userId) where.userId = filter.userId;
  if (filter.tipo) where.tipo = filter.tipo;
  if (filter.fissata === true) where.fissata = true;
  if (filter.fissata === false) where.fissata = false;
  if (filter.createdAtGte || filter.createdAtLte) {
    where.createdAt = {
      ...(filter.createdAtGte ? { gte: new Date(filter.createdAtGte) } : {}),
      ...(filter.createdAtLte ? { lte: new Date(filter.createdAtLte) } : {}),
    };
  }
  if (filter.userRoleIn?.length) {
    where.user = { role: { in: filter.userRoleIn } };
  }
  if (filter.praticaIdsIn?.length && filter.userRoleIn?.length) {
    // praticaIdsIn handled above; pratica scope via nested filter if needed
  }
  return where;
}

export const prismaAttivitaRepository = new PrismaAttivitaRepository();
