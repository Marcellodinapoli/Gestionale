import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  PostazioneCreateInput,
  PostazioneFilter,
  PostazioneUpdateInput,
  PostazioniRepository,
} from "../contracts/postazioni";

export class PrismaPostazioniRepository implements PostazioniRepository {
  async list(
    _tenantSlug: string,
    _tenantId: string,
    _filter?: import("../contracts/postazioni").PostazioneListOptions
  ): Promise<import("../contracts/postazioni").PostazioneDto[]> {
    throw new Error("use postazioniDb().findMany in firestore mode");
  }

  async count(_tenantSlug: string, tenantId: string, filter?: PostazioneFilter) {
    const where: Prisma.PostazioneWhereInput = { tenantId };
    if (filter?.active !== undefined) where.active = filter.active;
    if (filter?.id) where.id = filter.id;
    if (filter?.idsIn?.length) where.id = { in: filter.idsIn };
    if (filter?.nome) where.nome = filter.nome;
    if (filter?.sedeId) where.sedeId = filter.sedeId;
    if (filter?.excludeId) where.NOT = { id: filter.excludeId };
    return prisma.postazione.count({ where });
  }

  async getById(_tenantSlug: string, tenantId: string, id: string) {
    return prisma.postazione.findFirst({ where: { id, tenantId } });
  }

  async findByNome(
    _tenantSlug: string,
    tenantId: string,
    nome: string,
    excludeId?: string
  ) {
    return prisma.postazione.findFirst({
      where: {
        tenantId,
        nome,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
    });
  }

  async create(_tenantSlug: string, data: PostazioneCreateInput) {
    return prisma.postazione.create({
      data: data as unknown as Prisma.PostazioneCreateInput,
    });
  }

  async update(
    _tenantSlug: string,
    tenantId: string,
    id: string,
    data: PostazioneUpdateInput
  ) {
    return prisma.postazione.update({
      where: { id },
      data: data as Prisma.PostazioneUpdateInput,
    });
  }

  async delete(_tenantSlug: string, _tenantId: string, id: string) {
    await prisma.postazione.delete({ where: { id } });
  }
}

export const prismaPostazioniRepository = new PrismaPostazioniRepository();
