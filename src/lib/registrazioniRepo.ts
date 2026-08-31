import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isConnectorProvider } from "@/lib/data/factory";
import { createConnectorRegistrazioniRepository } from "@/lib/data/connector/ConnectorRegistrazioniRepository";
import { prismaRegistrazioniRepository } from "@/lib/data/prisma/PrismaRegistrazioniRepository";
import type { RegistrazioneFilter, RegistrazioniRepository } from "@/lib/data/contracts/registrazioni";
import { applySelect, mapSqlRow } from "@/lib/data/mapSqlRow";
import { resolveTenantSlug, praticaDb, type PraticaDbContext } from "@/lib/praticheRepo";
import type { SessionUser } from "@/lib/permissions";

export type RegistrazioniDbContext = Pick<PraticaDbContext, "tenantId" | "tenantSlug">;

function repo(ctx: RegistrazioniDbContext): RegistrazioniRepository {
  if (isConnectorProvider()) return createConnectorRegistrazioniRepository(ctx.tenantSlug);
  return prismaRegistrazioniRepository;
}

export function registrazioniDbFromUser(user: SessionUser) {
  return registrazioniDb({ tenantId: user.tenantId, tenantSlug: resolveTenantSlug(user) });
}

export function registrazioniDb(ctx: RegistrazioniDbContext): typeof prisma.registrazioneChiamata {
  if (!isConnectorProvider()) return prisma.registrazioneChiamata;

  const r = repo(ctx);
  return {
    findMany: async (args: Prisma.RegistrazioneChiamataFindManyArgs) => {
      const filter = await resolveFilter(ctx, args.where);
      const result = await r.list({
        tenantSlug: ctx.tenantSlug,
        tenantId: ctx.tenantId,
        filter,
        skip: args.skip ?? undefined,
        take: args.take ?? undefined,
        orderBy: { createdAt: "desc" },
        includeOperatore: hasInclude(args.include, "operatore"),
        includePraticaDebitore: hasPraticaDebitoreInclude(args.include),
      });
      return result.items.map((row) => mapFindManyRow(row, args)) as never[];
    },
    findFirst: async (args: Prisma.RegistrazioneChiamataFindFirstArgs) => {
      const filter = await resolveFilter(ctx, args.where);
      const row = await r.findFirst(ctx.tenantSlug, ctx.tenantId, filter ?? {});
      return row ? (mapFindManyRow(row, args) as never) : null;
    },
    create: async (args: Prisma.RegistrazioneChiamataCreateArgs) => {
      const data = args.data as Record<string, unknown>;
      return r.create(ctx.tenantSlug, ctx.tenantId, {
        praticaId: String(data.praticaId),
        operatoreId: String(data.operatoreId),
        numero: String(data.numero),
        direzione: data.direzione != null ? String(data.direzione) : undefined,
        stato: data.stato != null ? String(data.stato) : undefined,
        esito: data.esito != null ? String(data.esito) : null,
        durataSec: data.durataSec != null ? Number(data.durataSec) : undefined,
        fileName: data.fileName != null ? String(data.fileName) : undefined,
        evidenzaBackOffice: Boolean(data.evidenzaBackOffice),
      }) as never;
    },
    deleteMany: async (args: Prisma.RegistrazioneChiamataDeleteManyArgs) => {
      const result = await r.deleteMany(
        ctx.tenantSlug,
        ctx.tenantId,
        prismaWhereToFilter(args.where, ctx.tenantId) ?? {}
      );
      return { count: result.count } as never;
    },
  } as unknown as typeof prisma.registrazioneChiamata;
}

function hasInclude(include: unknown, key: string) {
  if (!include || typeof include !== "object") return false;
  return key in (include as Record<string, unknown>);
}

function hasPraticaDebitoreInclude(include: unknown) {
  if (!include || typeof include !== "object") return false;
  const pratica = (include as Record<string, unknown>).pratica;
  if (!pratica || typeof pratica !== "object") return false;
  return "debitore" in (pratica as Record<string, unknown>);
}

function mapFindManyRow(row: Record<string, unknown>, args: Prisma.RegistrazioneChiamataFindManyArgs) {
  const mapped = applySelect(row, args.select);
  if (args.include && typeof args.include === "object") {
    const inc = args.include as Record<string, unknown>;
    if ("operatore" in inc && row.operatore) {
      (mapped as Record<string, unknown>).operatore = applySelect(
        row.operatore as Record<string, unknown>,
        (inc.operatore as { select?: unknown })?.select
      );
    }
    if ("pratica" in inc && row.pratica) {
      const prRow = row.pratica as Record<string, unknown>;
      const prInc = inc.pratica as Record<string, unknown>;
      const praticaMapped = applySelect(prRow, prInc.select);
      if (prInc.select && typeof prInc.select === "object" && "debitore" in prInc.select) {
        (praticaMapped as Record<string, unknown>).debitore = applySelect(
          prRow.debitore as Record<string, unknown>,
          (prInc.select as { debitore?: unknown }).debitore
        );
      } else if (prInc.include && typeof prInc.include === "object" && "debitore" in prInc.include) {
        (praticaMapped as Record<string, unknown>).debitore = applySelect(
          prRow.debitore as Record<string, unknown>,
          (prInc.include as { debitore?: { select?: unknown } }).debitore?.select
        );
      }
      (mapped as Record<string, unknown>).pratica = praticaMapped;
    }
  }
  return mapped;
}

function prismaWhereToFilter(where: unknown, tenantId: string): RegistrazioneFilter | undefined {
  if (!where) return { tenantId };
  const filter: RegistrazioneFilter = { tenantId };
  const walk = (w: unknown, depth = 0) => {
    if (!w || typeof w !== "object") return;
    const node = w as Record<string, unknown>;

    if (node.id === "__none__") filter.none = true;
    if (typeof node.id === "string" && node.id !== "__none__") filter.id = node.id;
    if (typeof node.praticaId === "string") filter.praticaId = node.praticaId;
    if (typeof node.operatoreId === "string") filter.operatoreId = node.operatoreId;
    if (node.operatoreId && typeof node.operatoreId === "object") {
      const op = node.operatoreId as Record<string, unknown>;
      if (Array.isArray(op.in)) filter.operatoreIdIn = op.in.map(String);
    }
    if (node.evidenzaBackOffice === true) filter.evidenzaBackOffice = true;
    if (node.createdAt && typeof node.createdAt === "object") {
      const d = node.createdAt as Record<string, unknown>;
      if (d.gte instanceof Date) filter.createdAtGte = d.gte.toISOString();
      if (d.lte instanceof Date) filter.createdAtLte = d.lte.toISOString();
    }
    if (node.OR && Array.isArray(node.OR) && depth < 2) {
      const qParts = node.OR as Array<Record<string, unknown>>;
      const searchHints = qParts.some(
        (p) => p.pratica || p.operatore
      );
      if (searchHints && !filter.search) {
        filter.search = "__connector_search__";
      }
    }
    if (node.pratica && typeof node.pratica === "object" && depth < 3) {
      const p = node.pratica as Record<string, unknown>;
      if (typeof p.tenantId === "string") filter.tenantId = p.tenantId;
      walk(p, depth + 1);
    }
    if (node.AND && Array.isArray(node.AND)) node.AND.forEach((x) => walk(x, depth + 1));
  };
  walk(where);

  if (filter.search === "__connector_search__") {
    const q = extractSearchQuery(where);
    if (q) filter.search = q;
    else delete filter.search;
  }

  return filter;
}

function extractSearchQuery(where: unknown): string | undefined {
  if (!where || typeof where !== "object") return undefined;
  const node = where as Record<string, unknown>;
  if (node.OR && Array.isArray(node.OR)) {
    for (const item of node.OR) {
      if (!item || typeof item !== "object") continue;
      const o = item as Record<string, unknown>;
      if (o.pratica && typeof o.pratica === "object") {
        const p = o.pratica as Record<string, unknown>;
        if (p.numero && typeof p.numero === "object") {
          const n = p.numero as Record<string, unknown>;
          if (typeof n.contains === "string") return n.contains;
        }
      }
      if (o.operatore && typeof o.operatore === "object") {
        const u = o.operatore as Record<string, unknown>;
        if (u.name && typeof u.name === "object") {
          const n = u.name as Record<string, unknown>;
          if (typeof n.contains === "string") return n.contains;
        }
      }
    }
  }
  if (node.AND && Array.isArray(node.AND)) {
    for (const part of node.AND) {
      const q = extractSearchQuery(part);
      if (q) return q;
    }
  }
  return undefined;
}

async function resolveFilter(
  ctx: RegistrazioniDbContext,
  where: unknown
): Promise<RegistrazioneFilter | undefined> {
  const filter = prismaWhereToFilter(where, ctx.tenantId);
  if (!isConnectorProvider()) return filter;

  const praticaWhere = extractPraticaWhere(where);
  if (praticaWhere && !isSimpleTenantPraticaWhere(praticaWhere)) {
    const rows = await praticaDb(ctx).findMany({
      where: praticaWhere as Prisma.PraticaWhereInput,
      select: { id: true },
    });
    filter!.praticaIdsIn = rows.map((row) => String(row.id));
    if (!filter!.praticaIdsIn.length) filter!.none = true;
    delete filter!.tenantId;
  }
  return filter;
}

function extractPraticaWhere(where: unknown): Record<string, unknown> | undefined {
  if (!where || typeof where !== "object") return undefined;
  const node = where as Record<string, unknown>;
  if (node.pratica && typeof node.pratica === "object") {
    return node.pratica as Record<string, unknown>;
  }
  if (node.AND && Array.isArray(node.AND)) {
    for (const part of node.AND) {
      const p = extractPraticaWhere(part);
      if (p) return p;
      if (part && typeof part === "object" && (part as Record<string, unknown>).pratica) {
        return (part as Record<string, unknown>).pratica as Record<string, unknown>;
      }
    }
  }
  return undefined;
}

function isSimpleTenantPraticaWhere(praticaWhere: Record<string, unknown>) {
  const keys = Object.keys(praticaWhere);
  return keys.length === 1 && keys[0] === "tenantId";
}

export { mapSqlRow };
