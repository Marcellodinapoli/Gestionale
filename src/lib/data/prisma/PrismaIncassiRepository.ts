import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  IncassoAggregateRequest,
  IncassoCreateInput,
  IncassoFilter,
  IncassoGroupByMetodoRequest,
  IncassoListRequest,
  IncassiRepository,
  RegistraIncassoInput,
} from "../contracts/incassi";

export class PrismaIncassiRepository implements IncassiRepository {
  async list(_req: IncassoListRequest): Promise<{ items: Record<string, unknown>[]; total: number }> {
    throw new Error("use incassiDb() in firestore mode");
  }

  async count(_tenantSlug: string, _tenantId: string, filter?: IncassoFilter): Promise<number> {
    return prisma.incasso.count({ where: filterToPrismaWhere(filter) as Prisma.IncassoWhereInput });
  }

  async aggregate(req: IncassoAggregateRequest) {
    const result = await prisma.incasso.aggregate({
      _sum: { importo: true, capitale: true, interessi: true, spese: true },
      where: filterToPrismaWhere(req.filter) as Prisma.IncassoWhereInput,
    });
    return { _sum: result._sum as Record<string, number | null> };
  }

  async groupByMetodo(req: IncassoGroupByMetodoRequest) {
    const rows = await prisma.incasso.groupBy({
      by: ["metodo"],
      where: filterToPrismaWhere(req.filter) as Prisma.IncassoWhereInput,
      _sum: { importo: true },
      _count: true,
    });
    return rows.map((r) => ({
      metodo: r.metodo,
      _sum: { importo: r._sum.importo },
      _count: typeof r._count === "number" ? r._count : 0,
    }));
  }

  async getById(_tenantSlug: string, _tenantId: string, id: string) {
    return prisma.incasso.findUnique({ where: { id } }) as Promise<Record<string, unknown> | null>;
  }

  async create(_tenantSlug: string, _tenantId: string, data: IncassoCreateInput) {
    return prisma.incasso.create({
      data: data as unknown as Prisma.IncassoCreateInput,
    }) as Promise<Record<string, unknown>>;
  }

  async registra(_tenantSlug: string, _tenantId: string, input: RegistraIncassoInput) {
    return prisma.$transaction(async (tx) => {
      const incasso = await tx.incasso.create({
        data: input.incasso as unknown as Prisma.IncassoCreateInput,
      });
      if (input.provvigione) {
        await tx.provvigione.create({
          data: {
            ...input.provvigione,
            incassoId: incasso.id,
          } as unknown as Prisma.ProvvigioneCreateInput,
        });
      }
      await tx.pratica.update({
        where: { id: input.incasso.praticaId },
        data: input.praticaUpdate,
      });
      return incasso as Record<string, unknown>;
    });
  }
}

function filterToPrismaWhere(filter?: IncassoFilter): Record<string, unknown> {
  if (!filter) return {};
  if (filter.none) return { id: "__none__" };
  const where: Record<string, unknown> = {};
  if (filter.praticaId) where.praticaId = filter.praticaId;
  if (filter.praticaIdsIn?.length) where.praticaId = { in: filter.praticaIdsIn };
  if (filter.userId) where.userId = filter.userId;
  if (filter.dataGte || filter.dataLte) {
    where.data = {
      ...(filter.dataGte ? { gte: new Date(filter.dataGte) } : {}),
      ...(filter.dataLte ? { lte: new Date(filter.dataLte) } : {}),
    };
  }
  const pratica: Record<string, unknown> = {};
  if (filter.tenantId) pratica.tenantId = filter.tenantId;
  if (filter.mandanteId) pratica.mandanteId = filter.mandanteId;
  if (filter.numeroMandante) pratica.numeroMandante = filter.numeroMandante;
  if (filter.sedeId) {
    pratica.OR = [
      { assegnatario: { sedeId: filter.sedeId } },
      { operatoreTitolare: { sedeId: filter.sedeId } },
    ];
  }
  if (Object.keys(pratica).length) where.pratica = pratica;
  return where;
}

export const prismaIncassiRepository = new PrismaIncassiRepository();
