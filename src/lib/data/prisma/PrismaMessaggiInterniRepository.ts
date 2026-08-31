import "server-only";
import { prisma } from "@/lib/prisma";
import type {
  MessaggiInterniRepository,
  MessaggioInternoDto,
  MessaggioInternoFilter,
} from "../contracts/messaggiInterni";

function mapRow(r: {
  id: string;
  praticaId: string | null;
  fromUserId: string;
  toUserId: string;
  testo: string;
  letto: boolean;
  lettoAt: Date | null;
  createdAt: Date;
  fromUser?: { id: string; name: string };
  toUser?: { id: string; name: string };
  pratica?: {
    id: string;
    numero: string;
    debitore?: { nome: string; cognome: string };
  } | null;
}): MessaggioInternoDto {
  return {
    id: r.id,
    praticaId: r.praticaId,
    fromUserId: r.fromUserId,
    toUserId: r.toUserId,
    testo: r.testo,
    letto: r.letto,
    lettoAt: r.lettoAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
    fromUser: r.fromUser,
    toUser: r.toUser,
    pratica: r.pratica ?? undefined,
  };
}

function filterToWhere(filter?: MessaggioInternoFilter) {
  const where: Record<string, unknown> = {};
  if (filter?.toUserId) where.toUserId = filter.toUserId;
  if (filter?.fromUserId) where.fromUserId = filter.fromUserId;
  if (filter?.userId) {
    where.OR = [{ toUserId: filter.userId }, { fromUserId: filter.userId }];
  }
  if (filter?.letto === false) where.letto = false;
  return where;
}

export class PrismaMessaggiInterniRepository implements MessaggiInterniRepository {
  async list(_tenantSlug: string, _tenantId: string, filter?: MessaggioInternoFilter) {
    const rows = await prisma.messaggioInterno.findMany({
      where: filterToWhere(filter),
      include: {
        fromUser: { select: { id: true, name: true } },
        toUser: { select: { id: true, name: true } },
        pratica: {
          select: {
            id: true,
            numero: true,
            debitore: { select: { nome: true, cognome: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: filter?.take ?? 100,
    });
    return rows.map(mapRow);
  }

  async createMany(
    _tenantSlug: string,
    _tenantId: string,
    items: Array<{ fromUserId: string; toUserId: string; praticaId?: string | null; testo: string }>
  ) {
    if (!items.length) return;
    await prisma.messaggioInterno.createMany({
      data: items.map((item) => ({
        fromUserId: item.fromUserId,
        toUserId: item.toUserId,
        praticaId: item.praticaId ?? null,
        testo: item.testo,
      })),
    });
  }

  async getById(_tenantSlug: string, _tenantId: string, id: string) {
    const row = await prisma.messaggioInterno.findUnique({
      where: { id },
      include: {
        fromUser: { select: { id: true, name: true } },
        toUser: { select: { id: true, name: true } },
        pratica: {
          select: {
            id: true,
            numero: true,
            debitore: { select: { nome: true, cognome: true } },
          },
        },
      },
    });
    return row ? mapRow(row) : null;
  }

  async markLetto(_tenantSlug: string, _tenantId: string, id: string, letto: boolean) {
    await prisma.messaggioInterno.update({
      where: { id },
      data: { letto, lettoAt: letto ? new Date() : null },
    });
  }

  async updateTesto(_tenantSlug: string, _tenantId: string, id: string, testo: string) {
    await prisma.messaggioInterno.update({
      where: { id },
      data: { testo, letto: false, lettoAt: null },
    });
  }

  async delete(_tenantSlug: string, _tenantId: string, id: string) {
    await prisma.messaggioInterno.delete({ where: { id } });
  }

  async deleteByPratica(_tenantSlug: string, _tenantId: string, praticaId: string) {
    await prisma.messaggioInterno.deleteMany({ where: { praticaId } });
  }
}

export const prismaMessaggiInterniRepository = new PrismaMessaggiInterniRepository();
