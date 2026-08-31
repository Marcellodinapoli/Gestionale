import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isConnectorProvider } from "@/lib/data/factory";
import { createConnectorConfigurazioneRepository } from "@/lib/data/connector/ConnectorConfigurazioneRepository";
import { prismaConfigurazioneRepository } from "@/lib/data/prisma/PrismaConfigurazioneRepository";
import type { ConfigurazioneFilter, ConfigurazioneRepository } from "@/lib/data/contracts/configurazione";
import { applySelect } from "@/lib/data/mapSqlRow";
import { resolveTenantSlug, type PraticaDbContext } from "@/lib/praticheRepo";
import { resolveTenantSlugForConnector } from "@/lib/tenant";
import type { SessionUser } from "@/lib/permissions";

export type ConfigurazioneDbContext = Pick<PraticaDbContext, "tenantId" | "tenantSlug">;

async function connectorSlug(ctx: ConfigurazioneDbContext): Promise<string> {
  return resolveTenantSlugForConnector(ctx.tenantId, ctx.tenantSlug);
}

function repo(slug: string): ConfigurazioneRepository {
  if (isConnectorProvider()) return createConnectorConfigurazioneRepository(slug);
  return prismaConfigurazioneRepository;
}

export function configurazioneDbFromUser(user: SessionUser) {
  return configurazioneDb({ tenantId: user.tenantId, tenantSlug: resolveTenantSlug(user) });
}

export function configurazioneDb(ctx: ConfigurazioneDbContext): typeof prisma.configurazioneSistema {
  if (!isConnectorProvider()) return prisma.configurazioneSistema;

  return {
    findMany: async (args: Prisma.ConfigurazioneSistemaFindManyArgs) => {
      const slug = await connectorSlug(ctx);
      const r = repo(slug);
      const items = await r.list(slug, ctx.tenantId, prismaWhereToFilter(args.where));
      return items.map((row) => applySelect(row, args.select)) as never[];
    },
    findUnique: async (args: Prisma.ConfigurazioneSistemaFindUniqueArgs) => {
      const slug = await connectorSlug(ctx);
      const r = repo(slug);
      const where = args.where as { tenantId_chiave?: { tenantId: string; chiave: string } };
      if (!where?.tenantId_chiave) return null;
      const row = await r.findByChiave(
        slug,
        where.tenantId_chiave.tenantId,
        where.tenantId_chiave.chiave,
        args.select as Record<string, unknown> | undefined
      );
      return row ? (applySelect(row, args.select) as never) : null;
    },
    upsert: async (args: Prisma.ConfigurazioneSistemaUpsertArgs) => {
      const slug = await connectorSlug(ctx);
      const r = repo(slug);
      const create = args.create as { tenantId: string; chiave: string; valore: string; categoria: string };
      return r.upsert(slug, {
        tenantId: create.tenantId,
        chiave: create.chiave,
        valore: String((args.update as { valore?: string })?.valore ?? create.valore),
        categoria: String((args.update as { categoria?: string })?.categoria ?? create.categoria),
      }) as never;
    },
    deleteMany: async (args: Prisma.ConfigurazioneSistemaDeleteManyArgs) => {
      const slug = await connectorSlug(ctx);
      const r = repo(slug);
      return r.deleteMany(slug, ctx.tenantId, prismaWhereToFilter(args.where) ?? {});
    },
  } as unknown as typeof prisma.configurazioneSistema;
}

function prismaWhereToFilter(where: unknown): ConfigurazioneFilter | undefined {
  if (!where) return undefined;
  const filter: ConfigurazioneFilter = {};
  const walk = (w: unknown) => {
    if (!w || typeof w !== "object") return;
    const node = w as Record<string, unknown>;
    if (typeof node.tenantId === "string") filter.tenantId = node.tenantId;
    if (typeof node.chiave === "string") filter.chiave = node.chiave;
    if (typeof node.categoria === "string") filter.categoria = node.categoria;
    if (node.chiave && typeof node.chiave === "object") {
      const chiaveObj = node.chiave as Record<string, unknown>;
      if (Array.isArray(chiaveObj.in)) filter.chiaviIn = chiaveObj.in.map(String);
      if (typeof chiaveObj.startsWith === "string") filter.chiaveStartsWith = chiaveObj.startsWith;
    }
    if (node.OR && Array.isArray(node.OR)) {
      filter.chiaviOrStartsWith = node.OR.map((clause) => {
        if (!clause || typeof clause !== "object") return {};
        const c = clause as Record<string, unknown>;
        const chiave = c.chiave as Record<string, unknown> | undefined;
        if (chiave?.startsWith) return { startsWith: String(chiave.startsWith) };
        if (chiave?.in && Array.isArray(chiave.in)) return { in: chiave.in.map(String) };
        return {};
      });
    }
    if (node.AND && Array.isArray(node.AND)) node.AND.forEach(walk);
  };
  walk(where);
  return Object.keys(filter).length ? filter : undefined;
}

/** Tenant-scoped configurazione access when tenant context is known (e.g. telephony without session). */
export function configurazioneDbForTenant(tenantId: string, tenantSlug?: string) {
  return configurazioneDb({ tenantId, tenantSlug: tenantSlug ?? tenantId });
}
