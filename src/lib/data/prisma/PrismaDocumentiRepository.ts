import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  DocumentoCreateInput,
  DocumentoFilter,
  DocumentiRepository,
} from "../contracts/documenti";

export class PrismaDocumentiRepository implements DocumentiRepository {
  async create(_tenantSlug: string, tenantId: string, data: DocumentoCreateInput) {
    return prisma.documento.create({
      data: { ...data, tenantId } as unknown as Prisma.DocumentoCreateInput,
    }) as Promise<Record<string, unknown>>;
  }

  async deleteMany(_tenantSlug: string, _tenantId: string, filter: DocumentoFilter) {
    const result = await prisma.documento.deleteMany({
      where: { praticaId: filter.praticaId },
    });
    return { count: result.count };
  }
}

export const prismaDocumentiRepository = new PrismaDocumentiRepository();
