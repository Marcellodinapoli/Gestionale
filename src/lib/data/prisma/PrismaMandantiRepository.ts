import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  MandanteCreateInput,
  MandanteFilter,
  MandanteListRequest,
  MandanteUpdateInput,
  MandantiRepository,
} from "../contracts/mandanti";

export class PrismaMandantiRepository implements MandantiRepository {
  async list(_req: MandanteListRequest): Promise<{ items: import("../contracts/mandanti").MandanteDto[]; total: number }> {
    throw new Error("use mandantiDb().findMany in firestore mode");
  }

  async count(_tenantSlug: string, _tenantId: string, _filter?: MandanteFilter): Promise<number> {
    throw new Error("use mandantiDb().count in firestore mode");
  }

  async getById(_tenantSlug: string, _tenantId: string, id: string, includePraticaCount?: boolean) {
    return prisma.mandante.findFirst({
      where: { id },
      include: includePraticaCount ? { _count: { select: { pratiche: true } } } : undefined,
    }) as Promise<Record<string, unknown> | null>;
  }

  async create(_tenantSlug: string, data: MandanteCreateInput) {
    return prisma.mandante.create({
      data: data as unknown as Prisma.MandanteCreateInput,
    }) as Promise<Record<string, unknown>>;
  }

  async update(_tenantSlug: string, _tenantId: string, id: string, data: MandanteUpdateInput) {
    return prisma.mandante.update({
      where: { id },
      data: data as Prisma.MandanteUpdateInput,
    }) as Promise<Record<string, unknown>>;
  }

  async delete(_tenantSlug: string, _tenantId: string, id: string) {
    await prisma.mandante.delete({ where: { id } });
  }
}

export const prismaMandantiRepository = new PrismaMandantiRepository();
