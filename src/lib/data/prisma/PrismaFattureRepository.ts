import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  FatturaCreateInput,
  FatturaFilter,
  FattureRepository,
} from "../contracts/fatture";

export class PrismaFattureRepository implements FattureRepository {
  async create(_tenantSlug: string, tenantId: string, data: FatturaCreateInput) {
    return prisma.fattura.create({
      data: { ...data, tenantId } as unknown as Prisma.FatturaCreateInput,
    }) as Promise<Record<string, unknown>>;
  }

  async deleteMany(_tenantSlug: string, _tenantId: string, filter: FatturaFilter) {
    const result = await prisma.fattura.deleteMany({
      where: { praticaId: filter.praticaId },
    });
    return { count: result.count };
  }
}

export const prismaFattureRepository = new PrismaFattureRepository();
