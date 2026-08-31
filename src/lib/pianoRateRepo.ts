import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isConnectorProvider } from "@/lib/data/factory";
import { createConnectorPianoRateRepository } from "@/lib/data/connector/ConnectorPianoRateRepository";
import { prismaPianoRateRepository } from "@/lib/data/prisma/PrismaPianoRateRepository";
import type { PianoRateRepository } from "@/lib/data/contracts/pianoRate";
import { resolveTenantSlug, type PraticaDbContext } from "@/lib/praticheRepo";
import type { SessionUser } from "@/lib/permissions";

export type PianoRateDbContext = Pick<PraticaDbContext, "tenantId" | "tenantSlug">;

function repo(ctx: PianoRateDbContext): PianoRateRepository {
  if (isConnectorProvider()) return createConnectorPianoRateRepository(ctx.tenantSlug);
  return prismaPianoRateRepository;
}

export function pianoRateDbFromUser(user: SessionUser) {
  return pianoRateDb({ tenantId: user.tenantId, tenantSlug: resolveTenantSlug(user) });
}

export function pianoRateDb(ctx: PianoRateDbContext): typeof prisma.pianoRata {
  if (!isConnectorProvider()) return prisma.pianoRata;

  const r = repo(ctx);
  return {
    create: async (args: Prisma.PianoRataCreateArgs) => {
      const data = args.data as Record<string, unknown>;
      return r.create(ctx.tenantSlug, ctx.tenantId, {
        praticaId: String(data.praticaId),
        numeroRata: Number(data.numeroRata),
        importo: Number(data.importo),
        scadenza: data.scadenza as Date | string,
        pagata: Boolean(data.pagata),
      }) as never;
    },
    deleteMany: async (args: Prisma.PianoRataDeleteManyArgs) => {
      const where = args.where as { praticaId?: string } | undefined;
      const result = await r.deleteMany(ctx.tenantSlug, ctx.tenantId, {
        praticaId: where?.praticaId,
      });
      return { count: result.count } as never;
    },
  } as unknown as typeof prisma.pianoRata;
}

export async function createManyPianoRate(
  ctx: PianoRateDbContext,
  items: Array<{ praticaId: string; numeroRata: number; importo: number; scadenza: Date }>
) {
  if (!isConnectorProvider()) {
    const result = await prisma.pianoRata.createMany({
      data: items.map((item) => ({ ...item, tenantId: ctx.tenantId })),
    });
    return { count: result.count };
  }
  return repo(ctx).createMany(
    ctx.tenantSlug,
    ctx.tenantId,
    items.map((item) => ({
      praticaId: item.praticaId,
      numeroRata: item.numeroRata,
      importo: item.importo,
      scadenza: item.scadenza,
    }))
  );
}
