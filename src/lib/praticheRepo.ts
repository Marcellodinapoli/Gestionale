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
      const row = await r.getById(
        ctx.tenantSlug,
        ctx.tenantId,
        id,
        prismaArgsToInclude(args.include, args.select)
      );
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
        include: prismaArgsToInclude(args.include, args.select),
      });
      const row = items.items[0] ?? null;
      return row ? (applySelect(row, args.select) as never) : null;
    },
    findMany: async (args: Prisma.PraticaFindManyArgs) => {
      // Prisma senza `take` restituisce tutte le righe; col connector il default 25
      // tagliava silenziosamente elenchi (es. Affidi → solo le prime 25 = tutte PIANO nel seed).
      const take = args.take ?? 10_000;
      const result = await r.list({
        tenantSlug: ctx.tenantSlug,
        scope: toPraticaScope(ctx),
        filter: prismaWhereToFilter(args.where),
        sort: prismaOrderByToSort(args.orderBy),
        skip: args.skip ?? undefined,
        take,
        pageSize: take,
        include: prismaArgsToInclude(args.include, args.select),
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

function prismaArgsToInclude(
  include: unknown,
  select: unknown
): PraticaListRequest["include"] | undefined {
  const fromInclude = prismaIncludeToList(include);
  const fromSelect = prismaIncludeToList(select);
  if (!fromInclude?.length && !fromSelect?.length) return undefined;
  return Array.from(new Set([...(fromInclude || []), ...(fromSelect || [])])) as NonNullable<
    PraticaListRequest["include"]
  >;
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
    const sel = (select as Record<string, unknown>)[key];
    // Prisma select: true | nested object (include/orderBy/select)
    if (sel) out[key] = row[key] ?? (isRelationSelectKey(key) ? [] : undefined);
  }
  return out;
}

function isRelationSelectKey(key: string) {
  return [
    "attivita",
    "incassi",
    "fatture",
    "documenti",
    "rate",
    "garanti",
    "debitoreRecapiti",
  ].includes(key);
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

  const merge = <T>(key: keyof typeof filter, values: T[]) => {
    if (!values.length) return;
    const prev = (filter[key] as T[] | undefined) || [];
    (filter as Record<string, unknown>)[key as string] = [
      ...new Set([...prev, ...values].map(String)),
    ];
  };

  const extractOrOperatorePerimetro = (
    orNodes: unknown[],
    into: "in" | "notIn"
  ) => {
    const operatoreIds = new Set<string>();
    const periKeys = new Set<string>();
    let debitoreTerm: string | undefined;
    let telefonoTerm: string | undefined;
    let cfTerm: string | undefined;
    let garanteTerm: string | undefined;
    let noteTerm: string | undefined;

    for (const orNode of orNodes) {
      if (!orNode || typeof orNode !== "object") continue;
      const o = orNode as Record<string, unknown>;

      if (typeof o.numeroMandante === "string") periKeys.add(o.numeroMandante);
      if (o.numeroMandante && typeof o.numeroMandante === "object") {
        const nm = o.numeroMandante as Record<string, unknown>;
        if (Array.isArray(nm.in)) nm.in.forEach((v) => periKeys.add(String(v)));
      }
      if (o.importBatch && typeof o.importBatch === "object") {
        const ib = o.importBatch as { is?: { perimetro?: unknown } };
        const peri = ib.is?.perimetro;
        if (typeof peri === "string") periKeys.add(peri);
      }
      if (o.assegnatarioId && typeof o.assegnatarioId === "object") {
        const a = o.assegnatarioId as Record<string, unknown>;
        if (Array.isArray(a.in)) a.in.forEach((id) => operatoreIds.add(String(id)));
      }
      if (o.operatoreTitolareId && typeof o.operatoreTitolareId === "object") {
        const t = o.operatoreTitolareId as Record<string, unknown>;
        if (Array.isArray(t.in)) t.in.forEach((id) => operatoreIds.add(String(id)));
      }

      const containsOf = (node: unknown): string | undefined => {
        if (!node || typeof node !== "object") return undefined;
        const n = node as Record<string, unknown>;
        if (typeof n.contains === "string") return n.contains;
        return undefined;
      };

      if (o.debitore && typeof o.debitore === "object") {
        const d = o.debitore as Record<string, unknown>;
        const nome = containsOf(d.nome);
        const cognome = containsOf(d.cognome);
        if (nome || cognome) debitoreTerm = debitoreTerm || nome || cognome;
        const tel = containsOf(d.telefono);
        if (tel) telefonoTerm = telefonoTerm || tel;
        const cf = containsOf(d.codiceFiscale);
        if (cf) cfTerm = cfTerm || cf;
        if (d.recapiti && typeof d.recapiti === "object") {
          const some = (d.recapiti as { some?: { valore?: unknown } }).some;
          telefonoTerm = telefonoTerm || containsOf(some?.valore);
        }
      }
      if (o.garanti && typeof o.garanti === "object") {
        const some = (o.garanti as { some?: Record<string, unknown> }).some;
        if (some) {
          telefonoTerm = telefonoTerm || containsOf(some.telefono);
          cfTerm = cfTerm || containsOf(some.codiceFiscale);
          garanteTerm =
            garanteTerm ||
            containsOf(some.nome) ||
            containsOf(some.cognome) ||
            containsOf(some.codiceFiscale);
        }
      }
      noteTerm = noteTerm || containsOf(o.note);
      if (o.attivita && typeof o.attivita === "object") {
        const some = (o.attivita as { some?: { nota?: unknown } }).some;
        noteTerm = noteTerm || containsOf(some?.nota);
      }
    }

    if (into === "in") {
      if (operatoreIds.size) merge("operatoreIdsIn", [...operatoreIds]);
      if (periKeys.size) merge("perimetroKeys", [...periKeys]);
      // Debitore OR garante nello stesso OR → non AND-are i due filtri.
      if (debitoreTerm && garanteTerm) {
        filter.debitoreContains = debitoreTerm;
      } else {
        if (debitoreTerm) filter.debitoreContains = debitoreTerm;
        if (garanteTerm) filter.garanteContains = garanteTerm;
      }
      if (telefonoTerm) filter.telefonoContains = telefonoTerm;
      if (cfTerm) filter.cfPivaContains = cfTerm;
      if (noteTerm) filter.noteContains = noteTerm;
    } else {
      if (operatoreIds.size) merge("operatoreIdsNotIn", [...operatoreIds]);
      if (periKeys.size) merge("perimetroKeysNot", [...periKeys]);
      if (debitoreTerm && garanteTerm) {
        filter.debitoreNotContains = debitoreTerm;
      } else {
        if (debitoreTerm) filter.debitoreNotContains = debitoreTerm;
        if (garanteTerm) filter.garanteNotContains = garanteTerm;
      }
      if (telefonoTerm) filter.telefonoNotContains = telefonoTerm;
      if (cfTerm) filter.cfPivaNotContains = cfTerm;
      if (noteTerm) filter.noteNotContains = noteTerm;
    }
  };

  const walkNegated = (w: unknown) => {
    if (!w || typeof w !== "object") return;
    const node = w as Record<string, unknown>;

    if (typeof node.mandanteId === "string") {
      merge("mandanteIdsNotIn", [node.mandanteId]);
    }
    if (typeof node.numeroMandante === "string") {
      merge("numeroMandantiNotIn", [node.numeroMandante]);
    }
    if (node.assegnatarioId === null) {
      // NOT (assegnatario IS NULL) → ha assegnatario
      filter.hasAssegnatario = true;
    }
    if (node.assegnatarioId && typeof node.assegnatarioId === "object") {
      const a = node.assegnatarioId as Record<string, unknown>;
      if (a.not === null) {
        // NOT (assegnatario IS NOT NULL) → senza assegnatario
        filter.hasAssegnatario = false;
      }
      if (Array.isArray(a.in)) merge("assegnatarioIdsNotIn", a.in.map(String));
    }
    if (node.id && typeof node.id === "object") {
      const idObj = node.id as Record<string, unknown>;
      if (Array.isArray(idObj.in)) merge("excludeIds", idObj.in.map(String));
    }
    if (node.debitore && typeof node.debitore === "object") {
      const d = node.debitore as Record<string, unknown>;
      const containsOf = (v: unknown) =>
        v && typeof v === "object" && typeof (v as { contains?: unknown }).contains === "string"
          ? String((v as { contains: string }).contains)
          : undefined;
      const citta = containsOf(d.citta);
      const prov = containsOf(d.provincia);
      if (citta) filter.cittaNotContains = citta;
      if (prov) filter.provNotContains = prov;
    }
    if (node.OR && Array.isArray(node.OR)) {
      extractOrOperatorePerimetro(node.OR, "notIn");
    }
  };

  const walk = (w: unknown) => {
    if (!w || typeof w !== "object") return;
    const node = w as Record<string, unknown>;
    if (typeof node.tenantId === "string") {
      /* scope handled separately */
    }
    // Sentinel F1: evita traduzione OR debitore/garante → AND sul connector.
    if (node.cercaPratica && typeof node.cercaPratica === "object") {
      const c = node.cercaPratica as { campo?: string; q?: string };
      if (c.campo && c.q && String(c.q).trim().length >= 2) {
        filter.searchCampo = String(c.campo);
        filter.searchTerm = String(c.q).trim();
        filter.cercaAmpia = true;
      }
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
    if (typeof node.codiceScarico === "string") filter.codScarico = node.codiceScarico;
    if (node.codiceScarico === null) filter.codScaricoIsNull = true;
    if (node.codiceScarico && typeof node.codiceScarico === "object") {
      const c = node.codiceScarico as Record<string, unknown>;
      if (Array.isArray(c.in)) {
        filter.codScaricoIn = [
          ...new Set([...(filter.codScaricoIn || []), ...c.in.map(String)]),
        ];
      }
      if (Array.isArray(c.notIn)) {
        filter.codScaricoNotIn = [
          ...new Set([...(filter.codScaricoNotIn || []), ...c.notIn.map(String)]),
        ];
      }
      if (c.not === null) filter.codScaricoNotNull = true;
    }
    if (typeof node.codiceScaricoBk === "string") filter.codScaricoBk = node.codiceScaricoBk;
    if (node.codiceScaricoBk === null) filter.codScaricoBkIsNull = true;
    if (node.codiceScaricoBk && typeof node.codiceScaricoBk === "object") {
      const c = node.codiceScaricoBk as Record<string, unknown>;
      if (Array.isArray(c.in)) {
        filter.codScaricoBkIn = [
          ...new Set([...(filter.codScaricoBkIn || []), ...c.in.map(String)]),
        ];
      }
      if (Array.isArray(c.notIn)) {
        filter.codScaricoBkNotIn = [
          ...new Set([...(filter.codScaricoBkNotIn || []), ...c.notIn.map(String)]),
        ];
      }
      if (c.not === null) filter.codScaricoBkNotNull = true;
    }
    if (node.AND && Array.isArray(node.AND)) node.AND.forEach(walk);
    if (node.NOT) {
      const parts = Array.isArray(node.NOT) ? node.NOT : [node.NOT];
      parts.forEach(walkNegated);
    }
    if (node.OR && Array.isArray(node.OR)) {
      const perimetroOr: NonNullable<PraticaListRequest["filter"]>["perimetroOr"] = [];
      const cfIn = new Set<string>();
      for (const orNode of node.OR) {
        if (!orNode || typeof orNode !== "object") continue;
        const o = orNode as Record<string, unknown>;
        if (typeof o.mandanteId === "string") {
          const entry: { mandanteId: string; numeroMandanti?: string[] } = {
            mandanteId: o.mandanteId,
          };
          if (o.numeroMandante && typeof o.numeroMandante === "object") {
            const nm = o.numeroMandante as Record<string, unknown>;
            if (Array.isArray(nm.in)) entry.numeroMandanti = nm.in.map(String);
          }
          perimetroOr.push(entry);
        }
        // F9/F10: OR su CF debitore / garante
        if (o.debitore && typeof o.debitore === "object") {
          const d = o.debitore as Record<string, unknown>;
          if (d.codiceFiscale && typeof d.codiceFiscale === "object") {
            const cf = d.codiceFiscale as Record<string, unknown>;
            if (Array.isArray(cf.in)) cf.in.forEach((v) => cfIn.add(String(v)));
          }
        }
        if (o.garanti && typeof o.garanti === "object") {
          const some = (o.garanti as { some?: Record<string, unknown> }).some;
          if (some?.codiceFiscale && typeof some.codiceFiscale === "object") {
            const cf = some.codiceFiscale as Record<string, unknown>;
            if (Array.isArray(cf.in)) cf.in.forEach((v) => cfIn.add(String(v)));
          }
        }
        // Cod. scarico: null OR in / eq
        if (o.codiceScarico === null) filter.codScaricoIsNull = true;
        if (typeof o.codiceScarico === "string") {
          filter.codScaricoIn = [
            ...new Set([...(filter.codScaricoIn || []), o.codiceScarico]),
          ];
        }
        if (o.codiceScarico && typeof o.codiceScarico === "object") {
          const c = o.codiceScarico as Record<string, unknown>;
          if (Array.isArray(c.in)) {
            filter.codScaricoIn = [
              ...new Set([...(filter.codScaricoIn || []), ...c.in.map(String)]),
            ];
          }
        }
        if (o.codiceScaricoBk === null) filter.codScaricoBkIsNull = true;
        if (typeof o.codiceScaricoBk === "string") {
          filter.codScaricoBkIn = [
            ...new Set([...(filter.codScaricoBkIn || []), o.codiceScaricoBk]),
          ];
        }
        if (o.codiceScaricoBk && typeof o.codiceScaricoBk === "object") {
          const c = o.codiceScaricoBk as Record<string, unknown>;
          if (Array.isArray(c.in)) {
            filter.codScaricoBkIn = [
              ...new Set([...(filter.codScaricoBkIn || []), ...c.in.map(String)]),
            ];
          }
        }
      }
      if (perimetroOr.length) filter.perimetroOr = perimetroOr;
      if (cfIn.size) {
        filter.codiciFiscaliIn = [...new Set([...(filter.codiciFiscaliIn || []), ...cfIn])];
      }
      extractOrOperatorePerimetro(node.OR, "in");
    }
    if (node.OR && !Array.isArray(node.OR)) walk(node.OR);
    if (node.assegnatarioId === null) filter.hasAssegnatario = false;
    if (typeof node.assegnatarioId === "string") filter.assegnatarioId = node.assegnatarioId;
    if (node.assegnatarioId && typeof node.assegnatarioId === "object") {
      const a = node.assegnatarioId as Record<string, unknown>;
      if (Array.isArray(a.in)) filter.assegnatarioIdsIn = a.in.map(String);
      if (a.not === null) filter.hasAssegnatario = true;
    }
    if (typeof node.numeroMandante === "string") filter.numeroMandante = node.numeroMandante;
    if (node.numeroMandante && typeof node.numeroMandante === "object") {
      const nm = node.numeroMandante as Record<string, unknown>;
      if (Array.isArray(nm.in)) filter.numeroMandantiIn = nm.in.map(String);
      if (nm.not === null) filter.numeroMandanteNotNull = true;
    }
    if (node.debitore && typeof node.debitore === "object") {
      const d = node.debitore as Record<string, unknown>;
      const containsOf = (v: unknown) =>
        v && typeof v === "object" && typeof (v as { contains?: unknown }).contains === "string"
          ? String((v as { contains: string }).contains)
          : undefined;
      const citta = containsOf(d.citta);
      const prov = containsOf(d.provincia);
      if (citta) filter.cittaContains = citta;
      if (prov) filter.provContains = prov;
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
