import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  SedeCreateInput,
  SedeFilter,
  SedeUpdateInput,
  SediRepository,
} from "../contracts/sedi";

export class PrismaSediRepository implements SediRepository {
  async list(
    _tenantSlug: string,
    _tenantId: string,
    _filter?: SedeFilter & {
      orderBy?: "nome" | "createdAt";
      orderDir?: "asc" | "desc";
      take?: number;
      includeCounts?: boolean;
    }
  ): Promise<import("../contracts/sedi").SedeDto[]> {
    throw new Error("use sediDb().findMany in firestore mode");
  }

  async count(_tenantSlug: string, tenantId: string, filter?: SedeFilter) {
    const where: Prisma.SedeWhereInput = { tenantId };
    if (filter?.active !== undefined) where.active = filter.active;
    if (filter?.id) where.id = filter.id;
    if (filter?.idsIn?.length) where.id = { in: filter.idsIn };
    if (filter?.nome) where.nome = filter.nome;
    if (filter?.excludeId) where.NOT = { id: filter.excludeId };
    return prisma.sede.count({ where });
  }

  async getById(_tenantSlug: string, tenantId: string, id: string) {
    return prisma.sede.findFirst({ where: { id, tenantId } });
  }

  async findByNome(_tenantSlug: string, tenantId: string, nome: string, excludeId?: string) {
    return prisma.sede.findFirst({
      where: {
        tenantId,
        nome,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
    });
  }

  async create(_tenantSlug: string, data: SedeCreateInput) {
    return prisma.sede.create({
      data: data as unknown as Prisma.SedeCreateInput,
    });
  }

  async update(_tenantSlug: string, tenantId: string, id: string, data: SedeUpdateInput) {
    return prisma.sede.update({
      where: { id },
      data: data as Prisma.SedeUpdateInput,
    });
  }
}

export const prismaSediRepository = new PrismaSediRepository();
