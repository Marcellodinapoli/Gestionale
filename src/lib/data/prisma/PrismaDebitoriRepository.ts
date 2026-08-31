import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  DebitoreCreateInput,
  DebitoreFilter,
  DebitoreListRequest,
  DebitoreUpdateInput,
  DebitoriRepository,
  RecapitoCreateInput,
} from "../contracts/debitori";

export class PrismaDebitoriRepository implements DebitoriRepository {
  async list(_req: DebitoreListRequest): Promise<{ items: import("../contracts/debitori").DebitoreDto[]; total: number }> {
    throw new Error("use debitoriDb().findMany in firestore mode");
  }

  async idsByCf(_tenantSlug: string, tenantId: string, variants: string[]) {
    return prisma.debitore.findMany({
      where: { tenantId, codiceFiscale: { in: variants } },
      select: { id: true, codiceFiscale: true },
    }) as Promise<Record<string, unknown>[]>;
  }

  async getById(_tenantSlug: string, _tenantId: string, id: string) {
    return prisma.debitore.findUnique({ where: { id } }) as Promise<Record<string, unknown> | null>;
  }

  async create(_tenantSlug: string, data: DebitoreCreateInput) {
    return prisma.debitore.create({
      data: data as unknown as Prisma.DebitoreCreateInput,
    }) as Promise<Record<string, unknown>>;
  }

  async update(_tenantSlug: string, _tenantId: string, id: string, data: DebitoreUpdateInput) {
    return prisma.debitore.update({
      where: { id },
      data: data as Prisma.DebitoreUpdateInput,
    }) as Promise<Record<string, unknown>>;
  }

  async delete(_tenantSlug: string, _tenantId: string, id: string) {
    await prisma.debitore.delete({ where: { id } });
  }

  async countRecapiti(debitoreId: string, tipo?: string) {
    return prisma.debitoreRecapito.count({
      where: { debitoreId, ...(tipo ? { tipo } : {}) },
    });
  }

  async findFirstRecapito(filter: { id?: string; debitoreId?: string; tipo?: string }) {
    return prisma.debitoreRecapito.findFirst({ where: filter }) as Promise<Record<string, unknown> | null>;
  }

  async createRecapito(data: RecapitoCreateInput) {
    return prisma.debitoreRecapito.create({ data }) as Promise<Record<string, unknown>>;
  }

  async updateRecapito(id: string, data: Record<string, unknown>) {
    return prisma.debitoreRecapito.update({
      where: { id },
      data: data as Prisma.DebitoreRecapitoUpdateInput,
    }) as Promise<Record<string, unknown>>;
  }

  async deleteRecapito(id: string) {
    await prisma.debitoreRecapito.delete({ where: { id } });
  }

  async deleteRecapitiByDebitore(debitoreId: string) {
    await prisma.debitoreRecapito.deleteMany({ where: { debitoreId } });
  }
}

export const prismaDebitoriRepository = new PrismaDebitoriRepository();
