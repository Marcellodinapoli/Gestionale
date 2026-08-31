import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  PianoRataCreateInput,
  PianoRataFilter,
  PianoRateRepository,
} from "../contracts/pianoRate";

export class PrismaPianoRateRepository implements PianoRateRepository {
  async create(_tenantSlug: string, tenantId: string, data: PianoRataCreateInput) {
    return prisma.pianoRata.create({
      data: { ...data, tenantId } as unknown as Prisma.PianoRataCreateInput,
    }) as Promise<Record<string, unknown>>;
  }

  async createMany(_tenantSlug: string, tenantId: string, items: PianoRataCreateInput[]) {
    const result = await prisma.pianoRata.createMany({
      data: items.map((item) => ({ ...item, tenantId })) as Prisma.PianoRataCreateManyInput[],
    });
    return { count: result.count };
  }

  async deleteMany(_tenantSlug: string, _tenantId: string, filter: PianoRataFilter) {
    const result = await prisma.pianoRata.deleteMany({
      where: { praticaId: filter.praticaId },
    });
    return { count: result.count };
  }
}

export const prismaPianoRateRepository = new PrismaPianoRateRepository();
