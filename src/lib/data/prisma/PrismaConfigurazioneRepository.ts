import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  ConfigurazioneFilter,
  ConfigurazioneRepository,
  ConfigurazioneUpsertInput,
} from "../contracts/configurazione";

function buildWhere(tenantId: string, filter?: ConfigurazioneFilter): Prisma.ConfigurazioneSistemaWhereInput {
  const where: Prisma.ConfigurazioneSistemaWhereInput = { tenantId };
  if (!filter) return where;
  if (filter.chiave) where.chiave = filter.chiave;
  if (filter.chiaviIn?.length) where.chiave = { in: filter.chiaviIn };
  if (filter.categoria) where.categoria = filter.categoria;
  if (filter.chiaveStartsWith) where.chiave = { startsWith: filter.chiaveStartsWith };
  if (filter.chiaviOrStartsWith?.length) {
    where.OR = filter.chiaviOrStartsWith.map((clause) => {
      if (clause.startsWith) return { chiave: { startsWith: clause.startsWith } };
      if (clause.in?.length) return { chiave: { in: clause.in } };
      return {};
    });
  }
  return where;
}

export class PrismaConfigurazioneRepository implements ConfigurazioneRepository {
  async list(
    _tenantSlug: string,
    _tenantId: string,
    _filter?: ConfigurazioneFilter
  ): Promise<import("../contracts/configurazione").ConfigurazioneDto[]> {
    throw new Error("use configurazioneDb().findMany in firestore mode");
  }

  async findByChiave(
    _tenantSlug: string,
    tenantId: string,
    chiave: string,
    select?: Record<string, unknown>
  ) {
    return prisma.configurazioneSistema.findUnique({
      where: { tenantId_chiave: { tenantId, chiave } },
      select: select as Prisma.ConfigurazioneSistemaSelect | undefined,
    }) as Promise<import("../contracts/configurazione").ConfigurazioneDto | null>;
  }

  async upsert(_tenantSlug: string, data: ConfigurazioneUpsertInput) {
    return prisma.configurazioneSistema.upsert({
      where: { tenantId_chiave: { tenantId: data.tenantId, chiave: data.chiave } },
      create: data,
      update: { valore: data.valore, categoria: data.categoria },
    }) as Promise<import("../contracts/configurazione").ConfigurazioneDto>;
  }

  async deleteMany(_tenantSlug: string, tenantId: string, filter: ConfigurazioneFilter) {
    const result = await prisma.configurazioneSistema.deleteMany({
      where: buildWhere(tenantId, filter),
    });
    return { count: result.count };
  }
}

export const prismaConfigurazioneRepository = new PrismaConfigurazioneRepository();
