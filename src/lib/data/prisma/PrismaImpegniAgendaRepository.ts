import "server-only";
import { prisma } from "@/lib/prisma";
import type {
  ImpegnoAgendaDto,
  ImpegnoAgendaFilter,
  ImpegniAgendaRepository,
} from "../contracts/impegniAgenda";

function mapRow(r: {
  id: string;
  userId: string;
  titolo: string;
  nota: string | null;
  memoAt: Date;
  completato: boolean;
  completatoAt: Date | null;
  createdAt: Date;
  user?: { name: string } | null;
}): ImpegnoAgendaDto {
  return {
    id: r.id,
    userId: r.userId,
    titolo: r.titolo,
    nota: r.nota,
    memoAt: r.memoAt.toISOString(),
    completato: r.completato,
    completatoAt: r.completatoAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
    userName: r.user?.name,
  };
}

function filterToWhere(filter?: ImpegnoAgendaFilter) {
  const where: Record<string, unknown> = {};
  if (filter?.userId) where.userId = filter.userId;
  if (filter?.completato === false) where.completato = false;
  if (filter?.completato === true) where.completato = true;
  if (filter?.id) where.id = filter.id;
  if (filter?.memoAtGte || filter?.memoAtLte) {
    where.memoAt = {
      ...(filter.memoAtGte ? { gte: new Date(filter.memoAtGte) } : {}),
      ...(filter.memoAtLte ? { lte: new Date(filter.memoAtLte) } : {}),
    };
  }
  return where;
}

export class PrismaImpegniAgendaRepository implements ImpegniAgendaRepository {
  async list(_tenantSlug: string, _tenantId: string, filter?: ImpegnoAgendaFilter, take = 200) {
    const rows = await prisma.impegnoAgenda.findMany({
      where: filterToWhere(filter),
      include: { user: { select: { name: true } } },
      orderBy: { memoAt: "asc" },
      take,
    });
    return rows.map(mapRow);
  }

  async getById(_tenantSlug: string, _tenantId: string, id: string) {
    const row = await prisma.impegnoAgenda.findUnique({
      where: { id },
      include: { user: { select: { name: true } } },
    });
    return row ? mapRow(row) : null;
  }

  async create(
    _tenantSlug: string,
    _tenantId: string,
    data: { userId: string; titolo: string; nota?: string | null; memoAt: string | Date }
  ) {
    const row = await prisma.impegnoAgenda.create({
      data: {
        userId: data.userId,
        titolo: data.titolo,
        nota: data.nota ?? null,
        memoAt: new Date(data.memoAt),
      },
      include: { user: { select: { name: true } } },
    });
    return mapRow(row);
  }

  async complete(_tenantSlug: string, _tenantId: string, id: string, userId: string) {
    await prisma.impegnoAgenda.updateMany({
      where: { id, userId, completato: false },
      data: { completato: true, completatoAt: new Date() },
    });
  }

  async update(
    _tenantSlug: string,
    _tenantId: string,
    id: string,
    userId: string,
    data: { titolo?: string; nota?: string | null; memoAt?: string | Date }
  ) {
    const existing = await prisma.impegnoAgenda.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) return null;
    const row = await prisma.impegnoAgenda.update({
      where: { id },
      data: {
        ...(data.titolo != null ? { titolo: data.titolo } : {}),
        ...(data.nota !== undefined ? { nota: data.nota } : {}),
        ...(data.memoAt != null ? { memoAt: new Date(data.memoAt) } : {}),
      },
      include: { user: { select: { name: true } } },
    });
    return mapRow(row);
  }

  async delete(_tenantSlug: string, _tenantId: string, id: string, userId: string) {
    await prisma.impegnoAgenda.deleteMany({ where: { id, userId } });
  }
}

export const prismaImpegniAgendaRepository = new PrismaImpegniAgendaRepository();
