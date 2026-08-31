import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  RegistrazioneCreateInput,
  RegistrazioneFilter,
  RegistrazioneListRequest,
  RegistrazioniRepository,
} from "../contracts/registrazioni";

export class PrismaRegistrazioniRepository implements RegistrazioniRepository {
  async list(_req: RegistrazioneListRequest): Promise<{ items: import("../contracts/registrazioni").RegistrazioneDto[]; total: number }> {
    throw new Error("use registrazioniDb() in firestore mode");
  }

  async findFirst(_tenantSlug: string, _tenantId: string, filter: RegistrazioneFilter) {
    return prisma.registrazioneChiamata.findFirst({
      where: filterToPrismaWhere(filter) as Prisma.RegistrazioneChiamataWhereInput,
    }) as Promise<Record<string, unknown> | null>;
  }

  async create(_tenantSlug: string, tenantId: string, data: RegistrazioneCreateInput) {
    return prisma.registrazioneChiamata.create({
      data: { ...data, tenantId } as unknown as Prisma.RegistrazioneChiamataCreateInput,
    }) as Promise<Record<string, unknown>>;
  }

  async deleteMany(_tenantSlug: string, _tenantId: string, filter: RegistrazioneFilter) {
    const result = await prisma.registrazioneChiamata.deleteMany({
      where: filterToPrismaWhere(filter) as Prisma.RegistrazioneChiamataWhereInput,
    });
    return { count: result.count };
  }
}

function filterToPrismaWhere(filter?: RegistrazioneFilter): Record<string, unknown> {
  if (!filter) return {};
  if (filter.none) return { id: "__none__" };
  const where: Record<string, unknown> = {};
  if (filter.id) where.id = filter.id;
  if (filter.praticaId) where.praticaId = filter.praticaId;
  if (filter.praticaIdsIn?.length) where.praticaId = { in: filter.praticaIdsIn };
  if (filter.operatoreId) where.operatoreId = filter.operatoreId;
  if (filter.operatoreIdIn?.length) where.operatoreId = { in: filter.operatoreIdIn };
  if (filter.evidenzaBackOffice === true) where.evidenzaBackOffice = true;
  if (filter.createdAtGte || filter.createdAtLte) {
    where.createdAt = {
      ...(filter.createdAtGte ? { gte: new Date(filter.createdAtGte) } : {}),
      ...(filter.createdAtLte ? { lte: new Date(filter.createdAtLte) } : {}),
    };
  }
  return where;
}

export const prismaRegistrazioniRepository = new PrismaRegistrazioniRepository();
