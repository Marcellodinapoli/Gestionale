import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isConnectorProvider } from "@/lib/data/factory";
import { createConnectorPraticheRepository } from "@/lib/data/connector/ConnectorPraticheRepository";
import { prismaPraticheRepository } from "@/lib/data/prisma/PrismaPraticheRepository";
import type { PraticaListRequest, PraticaScope, PraticheRepository } from "@/lib/data/contracts/pratiche";
import type { Role, SessionUser } from "@/lib/permissions";

export type PraticaDbContext = {
  tenantId: string;
  tenantSlug: string;
  role?: Role;
  userId?: string;
  memberIds?: string[];
};

export function resolveTenantSlug(user: { tenantId: string; tenantSlug?: string | null }) {
  return user.tenantSlug ?? user.tenantId;
}

export function toPraticaScope(ctx: PraticaDbContext): PraticaScope {
  return {
    tenantId: ctx.tenantId,
    role: ctx.role ?? "ADMIN",
    userId: ctx.userId ?? ctx.tenantId,
    memberIds: ctx.memberIds,
  };
}

function repo(ctx: PraticaDbContext): PraticheRepository {
  if (isConnectorProvider()) return createConnectorPraticheRepository(ctx.tenantSlug);
  return prismaPraticheRepository;
}

export function praticaDbFromUser(user: SessionUser, memberIds?: string[]) {
  return praticaDb({
    tenantId: user.tenantId,
    tenantSlug: resolveTenantSlug(user),
    role: user.role,
    userId: user.id,
    memberIds,
  });
}

/** Drop-in sostituto di `prisma.pratica` con supporto connector. */
export function praticaDb(ctx: PraticaDbContext): typeof prisma.pratica {
  if (!isConnectorProvider()) return prisma.pratica;

  const r = repo(ctx);
  return {
    findUnique: async (args: Prisma.PraticaFindUniqueArgs) => {
      const id = String((args.where as { id?: string })?.id || "");
      if (!id) return null;
      const row = await r.getById(ctx.tenantSlug, ctx.tenantId, id, prismaIncludeToList(args.include));
      if (!row) return null;
      return applySelect(row, args.select) as never;
    },
    findFirst: async (args: Prisma.PraticaFindFirstArgs) => {
      if (
        args.orderBy &&
        typeof args.orderBy === "object" &&
        "createdAt" in args.orderBy &&
        args.where &&
        typeof args.where === "object" &&
        "tenantId" in args.where
      ) {
        return { numero: await r.nextNumero(ctx.tenantSlug, ctx.tenantId) } as never;
      }
      const items = await r.list({
        tenantSlug: ctx.tenantSlug,
        scope: toPraticaScope(ctx),
        filter: prismaWhereToFilter(args.where),
        take: 1,
        include: prismaIncludeToList(args.include),
      });
      const row = items.items[0] ?? null;
      return row ? (applySelect(row, args.select) as never) : null;
    },
    findMany: async (args: Prisma.PraticaFindManyArgs) => {
      const result = await r.list({
        tenantSlug: ctx.tenantSlug,
        scope: toPraticaScope(ctx),
        filter: prismaWhereToFilter(args.where),
        sort: prismaOrderByToSort(args.orderBy),
        skip: args.skip ?? undefined,
        take: args.take ?? undefined,
        pageSize: args.take ?? 25,
        include: prismaIncludeToList(args.include),
      });
      return result.items.map((row) => applySelect(row, args.select)) as never[];
    },
    count: async (args: Prisma.PraticaCountArgs) =>
      r.count({
        tenantSlug: ctx.tenantSlug,
        scope: toPraticaScope(ctx),
        filter: prismaWhereToFilter(args.where),
      }),
    create: async (args: Prisma.PraticaCreateArgs) =>
      r.create(ctx.tenantSlug, { tenantId: ctx.tenantId, ...(args.data as object) } as never) as never,
    update: async (args: Prisma.PraticaUpdateArgs) => {
      const id = String((args.where as { id?: string })?.id || "");
      return r.update(ctx.tenantSlug, ctx.tenantId, id, args.data as never) as never;
    },
    delete: async (args: Prisma.PraticaDeleteArgs) => {
      const id = String((args.where as { id?: string })?.id || "");
      await r.delete(ctx.tenantSlug, ctx.tenantId, id);
      return { id } as never;
    },
    groupBy: async (args: Prisma.PraticaGroupByArgs) => {
      if (Array.isArray(args.by) && args.by.includes("numeroMandante" as never)) {
        const items = await r.groupByNumeroMandante(
          ctx.tenantSlug,
          toPraticaScope(ctx),
          prismaWhereToFilter(args.where)
        );
        return items.map((i) => ({ numeroMandante: i.numeroMandante })) as never[];
      }
      throw new Error(`praticaDb.groupBy non supportato in connector mode: ${String(args.by)}`);
    },
  } as unknown as typeof prisma.pratica;
}

export async function nextNumeroPratica(ctx: PraticaDbContext) {
  return repo(ctx).nextNumero(ctx.tenantSlug, ctx.tenantId);
}

export async function idsAffidoTemporaneoForTenant(ctx: PraticaDbContext) {
  return repo(ctx).idsAffidoTemporaneo(ctx.tenantSlug, ctx.tenantId);
}

export async function idsImportoTotaleForTenant(ctx: PraticaDbContext, da?: number, a?: number) {
  return repo(ctx).idsImportoTotale(ctx.tenantSlug, ctx.tenantId, da, a);
}

export async function idsTotIncassatoForTenant(ctx: PraticaDbContext, da?: number, a?: number) {
  return repo(ctx).idsTotIncassato(ctx.tenantSlug, ctx.tenantId, da, a);
}

function prismaIncludeToList(include: unknown): PraticaListRequest["include"] | undefined {
  if (!include || typeof include !== "object") return undefined;
  const inc = include as Record<string, unknown>;
  const out: NonNullable<PraticaListRequest["include"]> = [];
  if (inc.debitore) out.push("debitore");
  if (inc.mandante) out.push("mandante");
  if (inc.assegnatario) out.push("assegnatario");
  if (inc.rate) out.push("rate");
  if (inc.incassi) out.push("incassi");
  if (inc.garanti) out.push("garanti");
  if (inc.attivita) out.push("attivita");
  if (inc.fatture) out.push("fatture");
  if (inc.documenti) out.push("documenti");
  if (inc.importBatch) out.push("importBatch");
  if (inc.debitore && typeof inc.debitore === "object" && (inc.debitore as { recapiti?: unknown }).recapiti) {
    out.push("debitoreRecapiti");
  }
  if (
    inc.garanti &&
    typeof inc.garanti === "object" &&
    (inc.garanti as { include?: { recapiti?: unknown } }).include?.recapiti
  ) {
    out.push("garantiRecapiti");
  }
  if (
    inc.incassi &&
    typeof inc.incassi === "object" &&
    (inc.incassi as { include?: { user?: unknown } }).include?.user
  ) {
    out.push("incassiUser");
  }
  if (
    inc.attivita &&
    typeof inc.attivita === "object" &&
    (inc.attivita as { include?: { user?: unknown } }).include?.user
  ) {
    out.push("attivitaUser");
  }
  return out.length ? out : undefined;
}

function applySelect(row: Record<string, unknown>, select: unknown) {
  if (!select || typeof select !== "object") return row;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(select as Record<string, unknown>)) {
    if ((select as Record<string, boolean>)[key]) out[key] = row[key];
  }
  return out;
}

function prismaOrderByToSort(orderBy: unknown): PraticaListRequest["sort"] | undefined {
  if (!orderBy || typeof orderBy !== "object") return undefined;
  const ob = orderBy as Record<string, unknown>;
  if ("updatedAt" in ob) return { field: "ultimaLavorazione", dir: ob.updatedAt === "asc" ? "asc" : "desc" };
  if ("numero" in ob) return { field: "numero", dir: ob.numero === "asc" ? "asc" : "desc" };
  if ("ultimaLavorazioneAt" in ob) {
    return { field: "ultimaLavorazione", dir: ob.ultimaLavorazioneAt === "asc" ? "asc" : "desc" };
  }
  if ("residuo" in ob) return { field: "residuo", dir: ob.residuo === "asc" ? "asc" : "desc" };
  if ("debitore" in ob && typeof ob.debitore === "object") {
    const d = ob.debitore as Record<string, string>;
    if (d.cognome) return { field: "debitore", dir: d.cognome === "asc" ? "asc" : "desc" };
    if (d.cap) return { field: "cap", dir: d.cap === "asc" ? "asc" : "desc" };
  }
  if ("mandante" in ob) return { field: "mandante", dir: "asc" };
  return undefined;
}

function prismaWhereToFilter(where: unknown): PraticaListRequest["filter"] {
  if (!where) return undefined;
  const filter: NonNullable<PraticaListRequest["filter"]> = {};
  const walk = (w: unknown) => {
    if (!w || typeof w !== "object") return;
    const node = w as Record<string, unknown>;
    if (typeof node.tenantId === "string") {
      /* scope handled separately */
    }
    if (node.id) {
      if (typeof node.id === "string") filter.ids = [node.id];
      else if (typeof node.id === "object") {
        const idObj = node.id as Record<string, unknown>;
        if (Array.isArray(idObj.in)) filter.idsIn = idObj.in.map(String);
      }
    }
    if (typeof node.stato === "string") filter.stato = node.stato;
    if (node.stato && typeof node.stato === "object") {
      const s = node.stato as Record<string, unknown>;
      if (Array.isArray(s.notIn)) filter.notStati = s.notIn.map(String);
    }
    if (typeof node.mandanteId === "string") filter.mandanteId = node.mandanteId;
    if (node.AND && Array.isArray(node.AND)) node.AND.forEach(walk);
    if (node.OR && Array.isArray(node.OR)) {
      const perimetroOr: NonNullable<PraticaListRequest["filter"]>["perimetroOr"] = [];
      for (const orNode of node.OR) {
        if (!orNode || typeof orNode !== "object") continue;
        const o = orNode as Record<string, unknown>;
        if (typeof o.mandanteId !== "string") continue;
        const entry: { mandanteId: string; numeroMandanti?: string[] } = { mandanteId: o.mandanteId };
        if (o.numeroMandante && typeof o.numeroMandante === "object") {
          const nm = o.numeroMandante as Record<string, unknown>;
          if (Array.isArray(nm.in)) entry.numeroMandanti = nm.in.map(String);
        }
        perimetroOr.push(entry);
      }
      if (perimetroOr.length) filter.perimetroOr = perimetroOr;
    }
    if (node.OR && !Array.isArray(node.OR)) walk(node.OR);
    if (node.assegnatarioId === null) filter.hasAssegnatario = false;
    if (typeof node.assegnatarioId === "string") filter.assegnatarioId = node.assegnatarioId;
    if (node.assegnatarioId && typeof node.assegnatarioId === "object") {
      const a = node.assegnatarioId as Record<string, unknown>;
      if (Array.isArray(a.in)) filter.assegnatarioIdsIn = a.in.map(String);
    }
    if (typeof node.numeroMandante === "string") filter.numeroMandante = node.numeroMandante;
    if (node.numeroMandante && typeof node.numeroMandante === "object") {
      const nm = node.numeroMandante as Record<string, unknown>;
      if (Array.isArray(nm.in)) filter.numeroMandantiIn = nm.in.map(String);
      if (nm.not === null) filter.numeroMandanteNotNull = true;
    }
    if (node.dataAffido && typeof node.dataAffido === "object") {
      const da = node.dataAffido as Record<string, unknown>;
      if (da.gte) filter.affidoGte = new Date(String(da.gte)).toISOString();
      if (da.lte) filter.affidoLte = new Date(String(da.lte)).toISOString();
      if (da.lt) filter.affidoLt = new Date(String(da.lt)).toISOString();
    }
    if (node.residuo && typeof node.residuo === "object") {
      const r = node.residuo as Record<string, number>;
      if (r.gte != null) filter.residuoGte = r.gte;
      if (r.lte != null) filter.residuoLte = r.lte;
    }
  };
  walk(where);
  return Object.keys(filter).length ? filter : undefined;
}

/** Legacy global — usa praticaDb(ctx) nei server action con utente autenticato. */
export function getPraticaModel(ctx: PraticaDbContext) {
  return praticaDb(ctx);
}
