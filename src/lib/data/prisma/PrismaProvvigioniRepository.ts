import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  ProvvigioneAggregateRequest,
  ProvvigioneFilter,
  ProvvigioneGroupByRequest,
  ProvvigioneListRequest,
  ProvvigioneUpdateInput,
  ProvvigioniRepository,
} from "../contracts/provvigioni";

export class PrismaProvvigioniRepository implements ProvvigioniRepository {
  async list(_req: ProvvigioneListRequest): Promise<{ items: import("../contracts/provvigioni").ProvvigioneDto[]; total: number }> {
    throw new Error("use provvigioniDb() in firestore mode");
  }

  async aggregate(req: ProvvigioneAggregateRequest) {
    const result = await prisma.provvigione.aggregate({
      _sum: { importo: true },
      _count: true,
      where: filterToPrismaWhere(req.filter) as Prisma.ProvvigioneWhereInput,
    });
    return {
      _sum: { importo: result._sum.importo },
      _count: typeof result._count === "number" ? result._count : 0,
    };
  }

  async groupBy(req: ProvvigioneGroupByRequest) {
    const by = req.by as ("operatoreId" | "stato")[];
    const rows = await prisma.provvigione.groupBy({
      by,
      where: filterToPrismaWhere(req.filter) as Prisma.ProvvigioneWhereInput,
      _sum: { importo: true },
      _count: true,
    });
    return rows.map((r) => ({
      operatoreId: "operatoreId" in r ? r.operatoreId : undefined,
      stato: "stato" in r ? r.stato : undefined,
      _sum: { importo: r._sum.importo },
      _count: typeof r._count === "number" ? r._count : 0,
    }));
  }

  async update(_tenantSlug: string, _tenantId: string, id: string, data: ProvvigioneUpdateInput) {
    return prisma.provvigione.update({
      where: { id },
      data: data as Prisma.ProvvigioneUpdateInput,
    }) as Promise<Record<string, unknown>>;
  }

  async updateMany(_tenantSlug: string, _tenantId: string, filter: ProvvigioneFilter, data: ProvvigioneUpdateInput) {
    const result = await prisma.provvigione.updateMany({
      where: filterToPrismaWhere(filter) as Prisma.ProvvigioneWhereInput,
      data: data as Prisma.ProvvigioneUpdateInput,
    });
    return { count: result.count };
  }

  async deleteMany(_tenantSlug: string, _tenantId: string, filter: ProvvigioneFilter) {
    const result = await prisma.provvigione.deleteMany({
      where: filterToPrismaWhere(filter) as Prisma.ProvvigioneWhereInput,
    });
    return { count: result.count };
  }
}

function filterToPrismaWhere(filter?: ProvvigioneFilter): Record<string, unknown> {
  if (!filter) return {};
  if (filter.none) return { id: "__none__" };
  const where: Record<string, unknown> = {};
  if (filter.id) where.id = filter.id;
  if (filter.idsIn?.length) where.id = { in: filter.idsIn };
  if (filter.praticaId) where.praticaId = filter.praticaId;
  if (filter.operatoreId) where.operatoreId = filter.operatoreId;
  if (filter.operatoreIdIn?.length) where.operatoreId = { in: filter.operatoreIdIn };
  if (filter.stato) where.stato = filter.stato;
  if (filter.createdAtGte || filter.createdAtLte) {
    where.createdAt = {
      ...(filter.createdAtGte ? { gte: new Date(filter.createdAtGte) } : {}),
      ...(filter.createdAtLte ? { lte: new Date(filter.createdAtLte) } : {}),
    };
  }
  const pratica: Record<string, unknown> = {};
  if (filter.tenantId) pratica.tenantId = filter.tenantId;
  if (filter.praticaMandanteId) pratica.mandanteId = filter.praticaMandanteId;
  if (filter.praticaNumeroMandante) pratica.numeroMandante = filter.praticaNumeroMandante;
  if (filter.praticaNumeroMandanteNull) {
    pratica.OR = [{ numeroMandante: null }, { numeroMandante: "" }];
  }
  if (filter.perimetroOr?.length) {
    pratica.OR = filter.perimetroOr.map((p) =>
      p.numeriMandante?.length
        ? { mandanteId: p.mandanteId, numeroMandante: { in: p.numeriMandante } }
        : { mandanteId: p.mandanteId }
    );
  }
  if (Object.keys(pratica).length) where.pratica = pratica;
  if (filter.operatoreSedeId) where.operatore = { sedeId: filter.operatoreSedeId };
  if (filter.operatoreOrSupervisorId) {
    where.operatore = {
      OR: [{ id: filter.operatoreOrSupervisorId }, { supervisorId: filter.operatoreOrSupervisorId }],
    };
  }
  return where;
}

export const prismaProvvigioniRepository = new PrismaProvvigioniRepository();
