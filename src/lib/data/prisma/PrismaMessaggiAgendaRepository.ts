import "server-only";
import { prisma } from "@/lib/prisma";
import type {
  MessaggiAgendaRepository,
  MessaggioAgendaDto,
  MessaggioAgendaFilter,
} from "../contracts/messaggiAgenda";

function mapRow(r: {
  id: string;
  praticaId: string;
  userId: string;
  memoAt: Date;
  line: string;
  letto: boolean;
  lettoAt: Date | null;
  createdAt: Date;
  pratica?: {
    id: string;
    numero: string;
    debitore?: { nome: string; cognome: string };
  };
  user?: { id: string; name: string };
}): MessaggioAgendaDto {
  return {
    id: r.id,
    praticaId: r.praticaId,
    userId: r.userId,
    memoAt: r.memoAt.toISOString(),
    line: r.line,
    letto: r.letto,
    lettoAt: r.lettoAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
    pratica: r.pratica,
    user: r.user,
  };
}

export class PrismaMessaggiAgendaRepository implements MessaggiAgendaRepository {
  async list(_tenantSlug: string, _tenantId: string, filter?: MessaggioAgendaFilter) {
    const rows = await prisma.messaggioAgenda.findMany({
      where: {
        ...(filter?.praticaId ? { praticaId: filter.praticaId } : {}),
        ...(filter?.letto === false ? { letto: false } : {}),
        ...(filter?.letto === true ? { letto: true } : {}),
      },
      include: {
        pratica: {
          select: {
            id: true,
            numero: true,
            debitore: { select: { nome: true, cognome: true } },
          },
        },
        user: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: filter?.take ?? 100,
    });
    return rows.map(mapRow);
  }

  async findOpenByPratica(_tenantSlug: string, _tenantId: string, praticaId: string) {
    const row = await prisma.messaggioAgenda.findFirst({
      where: { praticaId, letto: false },
      orderBy: { createdAt: "desc" },
    });
    return row ? mapRow(row) : null;
  }

  async upsertOpen(
    _tenantSlug: string,
    _tenantId: string,
    data: { praticaId: string; userId: string; memoAt: Date | string; line: string }
  ) {
    const aperto = await prisma.messaggioAgenda.findFirst({
      where: { praticaId: data.praticaId, letto: false },
      orderBy: { createdAt: "desc" },
    });
    if (aperto) {
      await prisma.messaggioAgenda.update({
        where: { id: aperto.id },
        data: {
          memoAt: new Date(data.memoAt),
          line: data.line,
          userId: data.userId,
        },
      });
      return;
    }
    await prisma.messaggioAgenda.create({
      data: {
        praticaId: data.praticaId,
        userId: data.userId,
        memoAt: new Date(data.memoAt),
        line: data.line,
      },
    });
  }

  async markLetto(_tenantSlug: string, _tenantId: string, id: string) {
    await prisma.messaggioAgenda.update({
      where: { id },
      data: { letto: true, lettoAt: new Date() },
    });
  }

  async markPraticaLetti(_tenantSlug: string, _tenantId: string, praticaId: string) {
    await prisma.messaggioAgenda.updateMany({
      where: { praticaId, letto: false },
      data: { letto: true, lettoAt: new Date() },
    });
  }

  async deleteByPratica(_tenantSlug: string, _tenantId: string, praticaId: string) {
    await prisma.messaggioAgenda.deleteMany({ where: { praticaId } });
  }

  async getById(_tenantSlug: string, _tenantId: string, id: string) {
    const row = await prisma.messaggioAgenda.findUnique({
      where: { id },
      include: {
        pratica: {
          select: {
            id: true,
            numero: true,
            debitore: { select: { nome: true, cognome: true } },
          },
        },
        user: { select: { id: true, name: true } },
      },
    });
    return row ? mapRow(row) : null;
  }
}

export const prismaMessaggiAgendaRepository = new PrismaMessaggiAgendaRepository();
