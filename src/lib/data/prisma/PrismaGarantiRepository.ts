import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  GaranteFilter,
  GaranteRecapitoCreateInput,
  GaranteUpdateInput,
  GarantiRepository,
} from "../contracts/garanti";

export class PrismaGarantiRepository implements GarantiRepository {
  async findFirst(filter: GaranteFilter) {
    return prisma.garante.findFirst({ where: filter as Prisma.GaranteWhereInput }) as Promise<
      Record<string, unknown> | null
    >;
  }

  async findManyByCf(_tenantSlug: string, _tenantId: string, variants: string[]) {
    return prisma.garante.findMany({
      where: { codiceFiscale: { in: variants } },
      select: { praticaId: true, codiceFiscale: true },
    }) as Promise<Record<string, unknown>[]>;
  }

  async update(_tenantSlug: string, _tenantId: string, id: string, data: GaranteUpdateInput) {
    return prisma.garante.update({
      where: { id },
      data: data as Prisma.GaranteUpdateInput,
    }) as Promise<Record<string, unknown>>;
  }

  async deleteManyByPratica(_tenantSlug: string, _tenantId: string, praticaId: string) {
    const garanti = await prisma.garante.findMany({
      where: { praticaId },
      select: { id: true },
    });
    for (const g of garanti) {
      await prisma.garanteRecapito.deleteMany({ where: { garanteId: g.id } });
    }
    await prisma.garante.deleteMany({ where: { praticaId } });
  }

  async countRecapiti(garanteId: string, tipo?: string) {
    return prisma.garanteRecapito.count({
      where: { garanteId, ...(tipo ? { tipo } : {}) },
    });
  }

  async findFirstRecapito(filter: { id?: string; garanteId?: string; tipo?: string }) {
    return prisma.garanteRecapito.findFirst({ where: filter }) as Promise<Record<string, unknown> | null>;
  }

  async createRecapito(data: GaranteRecapitoCreateInput) {
    return prisma.garanteRecapito.create({ data }) as Promise<Record<string, unknown>>;
  }

  async updateRecapito(id: string, data: Record<string, unknown>) {
    return prisma.garanteRecapito.update({
      where: { id },
      data: data as Prisma.GaranteRecapitoUpdateInput,
    }) as Promise<Record<string, unknown>>;
  }

  async deleteRecapito(id: string) {
    await prisma.garanteRecapito.delete({ where: { id } });
  }

  async deleteRecapitiByGarante(garanteId: string) {
    await prisma.garanteRecapito.deleteMany({ where: { garanteId } });
  }
}

export const prismaGarantiRepository = new PrismaGarantiRepository();
