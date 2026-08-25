/**
 * Backend operativo Credixa su Firestore.
 * API compatibile con i delegate Prisma usati dall'app.
 * Path: credixa/{tenantId}/{collection}/{id}
 */
import { randomBytes } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { getFirebaseFirestore } from "@/lib/firebase/admin";
import {
  MODEL_RELATIONS,
  PRISMA_DELEGATE_TO_MODEL,
  collectionForOpsModel,
} from "@/lib/firebase/opsCollections";

type Doc = Record<string, unknown>;

function cuidLike() {
  return `c${randomBytes(12).toString("hex")}`;
}

function reviveDates(doc: Doc): Doc {
  const out: Doc = { ...doc };
  for (const [k, v] of Object.entries(out)) {
    if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v)) {
      const d = new Date(v);
      if (!Number.isNaN(d.getTime())) out[k] = d;
    }
  }
  delete out._credixaMirror;
  return out;
}

function serializeForWrite(data: Doc): Doc {
  const out: Doc = {};
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined) continue;
    if (v instanceof Date) out[k] = v.toISOString();
    else if (typeof v === "bigint") out[k] = v.toString();
    else out[k] = v;
  }
  return out;
}

function matchScalar(actual: unknown, expected: unknown): boolean {
  if (expected === null) return actual == null;
  if (expected instanceof Date) {
    if (!(actual instanceof Date) && typeof actual !== "string") return false;
    return new Date(actual as string | Date).getTime() === expected.getTime();
  }
  if (typeof expected === "object" && expected !== null && !Array.isArray(expected)) {
    const e = expected as Doc;
    if ("equals" in e) return matchScalar(actual, e.equals);
    if ("not" in e) {
      const n = e.not;
      if (n === null) return actual != null;
      return !matchScalar(actual, n);
    }
    if ("in" in e) {
      const arr = e.in as unknown[];
      return arr.some((x) => matchScalar(actual, x));
    }
    if ("notIn" in e) {
      const arr = e.notIn as unknown[];
      return !arr.some((x) => matchScalar(actual, x));
    }
    if ("contains" in e) {
      return String(actual ?? "")
        .toLowerCase()
        .includes(String(e.contains).toLowerCase());
    }
    if ("startsWith" in e) {
      return String(actual ?? "")
        .toLowerCase()
        .startsWith(String(e.startsWith).toLowerCase());
    }
    if ("gte" in e || "gt" in e || "lte" in e || "lt" in e) {
      const toN = (x: unknown) => {
        if (x instanceof Date) return x.getTime();
        if (typeof x === "string" && /^\d{4}-\d{2}-\d{2}/.test(x)) return new Date(x).getTime();
        return Number(x);
      };
      const av = toN(actual);
      if ("gte" in e && !(av >= toN(e.gte))) return false;
      if ("gt" in e && !(av > toN(e.gt))) return false;
      if ("lte" in e && !(av <= toN(e.lte))) return false;
      if ("lt" in e && !(av < toN(e.lt))) return false;
      return true;
    }
    return false;
  }
  return actual === expected;
}

async function listTenantIds(db: ReturnType<typeof getFirebaseFirestore>): Promise<string[]> {
  const roots = await db.collection("credixa").listDocuments();
  return roots.map((r) => r.id);
}

async function loadCollection(model: string, tenantId?: string | null): Promise<Doc[]> {
  const col = collectionForOpsModel(model);
  if (!col) return [];
  const db = getFirebaseFirestore();

  if (model === "Tenant") {
    if (tenantId) {
      const snap = await db.doc(`credixa/${tenantId}/_meta/tenant`).get();
      if (!snap.exists) return [];
      return [reviveDates({ id: tenantId, ...(snap.data() as Doc) })];
    }
    const ids = await listTenantIds(db);
    const rows: Doc[] = [];
    for (const id of ids) {
      const snap = await db.doc(`credixa/${id}/_meta/tenant`).get();
      if (!snap.exists) continue;
      rows.push(reviveDates({ id, ...(snap.data() as Doc) }));
    }
    return rows;
  }

  if (tenantId) {
    const snap = await db.collection(`credixa/${tenantId}/${col}`).get();
    return snap.docs.map((d) => reviveDates({ id: d.id, tenantId, ...(d.data() as Doc) }));
  }

  // Evita collectionGroup (richiede indici): scorre i tenant.
  const ids = await listTenantIds(db);
  const rows: Doc[] = [];
  for (const tid of ids) {
    const snap = await db.collection(`credixa/${tid}/${col}`).get();
    for (const d of snap.docs) {
      rows.push(reviveDates({ id: d.id, tenantId: tid, ...(d.data() as Doc) }));
    }
  }
  return rows;
}

async function getById(model: string, id: string): Promise<Doc | null> {
  const col = collectionForOpsModel(model);
  if (!col || !id) return null;
  const db = getFirebaseFirestore();

  if (model === "Tenant") {
    const snap = await db.doc(`credixa/${id}/_meta/tenant`).get();
    if (!snap.exists) return null;
    return reviveDates({ id, ...(snap.data() as Doc) });
  }

  const ids = await listTenantIds(db);
  for (const tid of ids) {
    const snap = await db.doc(`credixa/${tid}/${col}/${id}`).get();
    if (snap.exists) {
      return reviveDates({ id, tenantId: tid, ...(snap.data() as Doc) });
    }
  }
  return null;
}

async function resolveTenantId(row: Doc): Promise<string> {
  if (typeof row.tenantId === "string" && row.tenantId) return row.tenantId;
  const tryIds: Array<[string, string]> = [
    ["Pratica", String(row.praticaId || "")],
    ["User", String(row.userId || "")],
    ["User", String(row.fromUserId || "")],
    ["User", String(row.operatoreId || "")],
    ["Debitore", String(row.debitoreId || "")],
    ["Garante", String(row.garanteId || "")],
  ];
  for (const [m, id] of tryIds) {
    if (!id || id === "undefined") continue;
    const found = await getById(m, id);
    if (found?.tenantId) return String(found.tenantId);
  }
  throw new Error("tenantId mancante per scrittura Firebase");
}

async function saveDoc(model: string, row: Doc) {
  const col = collectionForOpsModel(model);
  if (!col) throw new Error(`Modello non supportato su Firebase: ${model}`);
  const db = getFirebaseFirestore();
  const id = String(row.id || "");
  if (!id) throw new Error(`Documento senza id (${model})`);

  if (model === "Tenant") {
    await db.doc(`credixa/${id}/_meta/tenant`).set(serializeForWrite({ ...row, id }), {
      merge: true,
    });
    return;
  }

  const tid = await resolveTenantId(row);
  const payload = serializeForWrite({ ...row, id, tenantId: tid });
  await db.doc(`credixa/${tid}/${col}/${id}`).set(payload, { merge: true });
}

async function deleteDoc(model: string, row: Doc) {
  const col = collectionForOpsModel(model);
  if (!col) return;
  const db = getFirebaseFirestore();
  const id = String(row.id || "");
  if (model === "Tenant") {
    await db.doc(`credixa/${id}/_meta/tenant`).delete();
    return;
  }
  let tid = String(row.tenantId || "");
  if (!tid) {
    const existing = await getById(model, id);
    tid = String(existing?.tenantId || "");
  }
  if (tid && id) await db.doc(`credixa/${tid}/${col}/${id}`).delete();
}

async function matchWhere(model: string, row: Doc, where: Doc | undefined): Promise<boolean> {
  if (!where || !Object.keys(where).length) return true;

  if (Array.isArray(where.AND)) {
    for (const part of where.AND as Doc[]) {
      if (!(await matchWhere(model, row, part))) return false;
    }
    return true;
  }
  if (Array.isArray(where.OR)) {
    for (const part of where.OR as Doc[]) {
      if (await matchWhere(model, row, part)) return true;
    }
    return false;
  }
  if (where.NOT) {
    const n = where.NOT;
    if (Array.isArray(n)) {
      for (const part of n as Doc[]) {
        if (await matchWhere(model, row, part)) return false;
      }
      return true;
    }
    return !(await matchWhere(model, row, n as Doc));
  }

  const relations = MODEL_RELATIONS[model] || {};

  for (const [key, expected] of Object.entries(where)) {
    if (key === "AND" || key === "OR" || key === "NOT") continue;
    const rel = relations[key];
    if (rel && !rel.many) {
      const localVal = row[rel.local];
      if (localVal == null) {
        if (expected === null) continue;
        if (typeof expected === "object" && expected && (expected as Doc).equals === null) continue;
        return false;
      }
      const related = await getById(rel.model, String(localVal));
      if (!related) return false;
      if (typeof expected === "object" && expected !== null && !Array.isArray(expected)) {
        if (!(await matchWhere(rel.model, related, expected as Doc))) return false;
      }
      continue;
    }
    if (!matchScalar(row[key], expected)) return false;
  }
  return true;
}

function applySelect(row: Doc, select: Doc | undefined): Doc {
  if (!select) return row;
  const out: Doc = {};
  for (const [k, v] of Object.entries(select)) {
    if (v) out[k] = row[k];
  }
  out.id = row.id;
  return out;
}

function sortRows(rows: Doc[], orderBy: Doc | Doc[] | undefined): Doc[] {
  if (!orderBy) return rows;
  const orders = Array.isArray(orderBy) ? orderBy : [orderBy];
  return [...rows].sort((a, b) => {
    for (const ord of orders) {
      const entry = Object.entries(ord)[0];
      if (!entry) continue;
      const [field, dir] = entry;
      const av = a[field];
      const bv = b[field];
      if (av == null && bv == null) continue;
      if (av == null) return dir === "asc" ? -1 : 1;
      if (bv == null) return dir === "asc" ? 1 : -1;
      if ((av as never) < (bv as never)) return dir === "desc" ? 1 : -1;
      if ((av as never) > (bv as never)) return dir === "desc" ? -1 : 1;
    }
    return 0;
  });
}

async function resolveIncludes(model: string, row: Doc, include: Doc | undefined): Promise<Doc> {
  if (!include) return row;
  const relations = MODEL_RELATIONS[model] || {};
  const out: Doc = { ...row };

  for (const [key, conf] of Object.entries(include)) {
    if (!conf || key === "_count") continue;
    const rel = relations[key];
    if (!rel) continue;
    const nestedInclude =
      typeof conf === "object" && conf && "include" in (conf as Doc)
        ? ((conf as Doc).include as Doc)
        : undefined;
    const nestedSelect =
      typeof conf === "object" && conf && "select" in (conf as Doc)
        ? ((conf as Doc).select as Doc)
        : undefined;

    if (rel.many) {
      const all = await loadCollection(rel.model, row.tenantId as string | undefined);
      let related = all.filter((r) => String(r[rel.foreign]) === String(row[rel.local]));
      related = await Promise.all(
        related.map(async (r) => {
          let x = nestedSelect ? applySelect(r, nestedSelect) : r;
          if (nestedInclude) x = await resolveIncludes(rel.model, x, nestedInclude);
          return x;
        })
      );
      out[key] = related;
    } else {
      const localVal = row[rel.local];
      if (localVal == null) {
        out[key] = null;
        continue;
      }
      let related = await getById(rel.model, String(localVal));
      if (related) {
        if (nestedSelect) related = applySelect(related, nestedSelect);
        if (nestedInclude) related = await resolveIncludes(rel.model, related, nestedInclude);
      }
      out[key] = related;
    }
  }

  if (include._count) {
    const countConf = include._count as Doc;
    const select = (countConf.select || countConf) as Doc;
    const counts: Doc = {};
    for (const [key, on] of Object.entries(select)) {
      if (!on) continue;
      const rel = relations[key];
      if (!rel?.many) {
        counts[key] = 0;
        continue;
      }
      const all = await loadCollection(rel.model, row.tenantId as string | undefined);
      counts[key] = all.filter((r) => String(r[rel.foreign]) === String(row[rel.local])).length;
    }
    out._count = counts;
  }

  return out;
}

function extractTenantHint(where: Doc | undefined): string | undefined {
  if (!where) return undefined;
  if (typeof where.tenantId === "string") return where.tenantId;
  if (where.tenantId && typeof where.tenantId === "object" && "equals" in (where.tenantId as Doc)) {
    return String((where.tenantId as Doc).equals);
  }
  if (Array.isArray(where.AND)) {
    for (const p of where.AND as Doc[]) {
      const t = extractTenantHint(p);
      if (t) return t;
    }
  }
  return undefined;
}

function createDelegate(model: string) {
  const api = {
    async findUnique(args: { where: Doc; include?: Doc; select?: Doc }) {
      const where = args.where || {};
      let row: Doc | null = null;
      if (typeof where.id === "string") row = await getById(model, where.id);
      else if (where.tenantId_email) {
        const te = where.tenantId_email as Doc;
        const all = await loadCollection(model, String(te.tenantId));
        row =
          all.find(
            (r) =>
              String(r.tenantId) === String(te.tenantId) &&
              String(r.email).toLowerCase() === String(te.email).toLowerCase()
          ) || null;
      } else if (where.tenantId_nome) {
        const tn = where.tenantId_nome as Doc;
        const all = await loadCollection(model, String(tn.tenantId));
        row =
          all.find(
            (r) => String(r.tenantId) === String(tn.tenantId) && String(r.nome) === String(tn.nome)
          ) || null;
      } else if (where.tenantId_codice) {
        const tc = where.tenantId_codice as Doc;
        const all = await loadCollection(model, String(tc.tenantId));
        row =
          all.find(
            (r) =>
              String(r.tenantId) === String(tc.tenantId) && String(r.codice) === String(tc.codice)
          ) || null;
      } else if (where.tenantId_numero) {
        const tn = where.tenantId_numero as Doc;
        const all = await loadCollection(model, String(tn.tenantId));
        row =
          all.find(
            (r) =>
              String(r.tenantId) === String(tn.tenantId) && String(r.numero) === String(tn.numero)
          ) || null;
      } else if (where.praticaId && model === "PraticaLock") {
        const all = await loadCollection(model);
        row = all.find((r) => String(r.praticaId) === String(where.praticaId)) || null;
      } else if (where.incassoId && model === "Provvigione") {
        const all = await loadCollection(model);
        row = all.find((r) => String(r.incassoId) === String(where.incassoId)) || null;
      } else {
        const all = await loadCollection(model, extractTenantHint(where));
        for (const r of all) {
          if (await matchWhere(model, r, where)) {
            row = r;
            break;
          }
        }
      }
      if (!row) return null;
      if (!(await matchWhere(model, row, where))) return null;
      let out = row;
      if (args.include) out = await resolveIncludes(model, out, args.include);
      if (args.select) out = applySelect(out, args.select);
      return out;
    },

    async findFirst(
      args: { where?: Doc; include?: Doc; select?: Doc; orderBy?: Doc | Doc[] } = {}
    ) {
      const rows = await api.findMany({ ...args, take: 1 });
      return rows[0] || null;
    },

    async findMany(
      args: {
        where?: Doc;
        include?: Doc;
        select?: Doc;
        orderBy?: Doc | Doc[];
        take?: number;
        skip?: number;
        distinct?: string[];
      } = {}
    ) {
      let rows = await loadCollection(model, extractTenantHint(args.where));
      const filtered: Doc[] = [];
      for (const r of rows) {
        if (await matchWhere(model, r, args.where)) filtered.push(r);
      }
      rows = sortRows(filtered, args.orderBy);
      if (args.distinct?.length) {
        const seen = new Set<string>();
        rows = rows.filter((r) => {
          const key = args.distinct!.map((f) => String(r[f])).join("|");
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      }
      if (args.skip) rows = rows.slice(args.skip);
      if (args.take != null) rows = rows.slice(0, args.take);

      const out: Doc[] = [];
      for (const r of rows) {
        let x = r;
        if (args.include) x = await resolveIncludes(model, x, args.include);
        if (args.select) x = applySelect(x, args.select);
        out.push(x);
      }
      return out;
    },

    async create(args: { data: Doc; include?: Doc }) {
      const data = { ...args.data };
      if (!data.id) data.id = cuidLike();
      if (!data.createdAt) data.createdAt = new Date();
      await saveDoc(model, data);
      let row = (await getById(model, String(data.id))) || data;
      if (args.include) row = await resolveIncludes(model, row, args.include);
      return row;
    },

    async update(args: { where: Doc; data: Doc; include?: Doc }) {
      const existing = await api.findUnique({ where: args.where });
      if (!existing) throw new Error(`Record non trovato (${model})`);
      const data = { ...args.data };
      for (const [k, v] of Object.entries(data)) {
        if (v && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date)) {
          const op = v as Doc;
          if ("set" in op) data[k] = op.set;
          else if ("increment" in op) data[k] = Number(existing[k] || 0) + Number(op.increment);
          else if ("decrement" in op) data[k] = Number(existing[k] || 0) - Number(op.decrement);
        }
      }
      const merged: Doc = { ...existing, ...data, id: existing.id, tenantId: existing.tenantId };
      for (const rel of Object.keys(MODEL_RELATIONS[model] || {})) delete merged[rel];
      delete merged._count;
      await saveDoc(model, merged);
      let row = (await getById(model, String(existing.id))) || merged;
      if (args.include) row = await resolveIncludes(model, row, args.include);
      return row;
    },

    async upsert(args: { where: Doc; create: Doc; update: Doc; include?: Doc }) {
      const existing = await api.findUnique({ where: args.where });
      if (existing) return api.update({ where: args.where, data: args.update, include: args.include });
      return api.create({ data: args.create, include: args.include });
    },

    async delete(args: { where: Doc }) {
      const existing = await api.findUnique({ where: args.where });
      if (!existing) throw new Error(`Record non trovato (${model})`);
      await deleteDoc(model, existing);
      return existing;
    },

    async deleteMany(args: { where?: Doc } = {}) {
      const rows = await api.findMany({ where: args.where });
      for (const r of rows) await deleteDoc(model, r);
      return { count: rows.length };
    },

    async updateMany(args: { where?: Doc; data: Doc }) {
      const rows = await api.findMany({ where: args.where });
      for (const r of rows) await api.update({ where: { id: r.id }, data: args.data });
      return { count: rows.length };
    },

    async count(args: { where?: Doc } = {}) {
      const rows = await api.findMany({ where: args.where });
      return rows.length;
    },

    async createMany(args: { data: Doc[] }) {
      for (const d of args.data) await api.create({ data: d });
      return { count: args.data.length };
    },

    async aggregate(args: { where?: Doc; _sum?: Doc; _avg?: Doc; _count?: boolean | Doc }) {
      const rows = await api.findMany({ where: args.where });
      const result: Doc = {};
      if (args._count) result._count = { _all: rows.length };
      if (args._sum) {
        const sum: Doc = {};
        for (const k of Object.keys(args._sum)) {
          sum[k] = rows.reduce((s, r) => s + Number(r[k] || 0), 0);
        }
        result._sum = sum;
      }
      if (args._avg) {
        const avg: Doc = {};
        for (const k of Object.keys(args._avg)) {
          avg[k] = rows.length
            ? rows.reduce((s, r) => s + Number(r[k] || 0), 0) / rows.length
            : null;
        }
        result._avg = avg;
      }
      return result;
    },

    async groupBy(args: {
      by: string[];
      where?: Doc;
      _count?: boolean | Doc;
      _sum?: Doc;
      orderBy?: Doc | Doc[];
    }) {
      const rows = await api.findMany({ where: args.where });
      const map = new Map<string, Doc[]>();
      for (const r of rows) {
        const key = args.by.map((f) => String(r[f])).join("|");
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(r);
      }
      const out: Doc[] = [];
      for (const [, group] of map) {
        const row: Doc = {};
        for (const f of args.by) row[f] = group[0]![f];
        if (args._count) row._count = { _all: group.length };
        if (args._sum) {
          const sum: Doc = {};
          for (const k of Object.keys(args._sum)) {
            sum[k] = group.reduce((s, r) => s + Number(r[k] || 0), 0);
          }
          row._sum = sum;
        }
        out.push(row);
      }
      return sortRows(out, args.orderBy);
    },
  };
  return api;
}

export function createFirebasePrisma(): PrismaClient {
  const delegates: Record<string, ReturnType<typeof createDelegate>> = {};
  for (const [delegate, model] of Object.entries(PRISMA_DELEGATE_TO_MODEL)) {
    delegates[delegate] = createDelegate(model);
  }

  const client = {
    ...delegates,
    async $connect() {},
    async $disconnect() {},
    async $transaction(arg: unknown) {
      if (typeof arg === "function") return (arg as (c: unknown) => unknown)(client);
      if (Array.isArray(arg)) {
        const out = [];
        for (const p of arg) out.push(await p);
        return out;
      }
      throw new Error("$transaction non supportata");
    },
    async $queryRaw() {
      throw new Error("SQL raw non disponibile con OPERATIONAL_BACKEND=firebase");
    },
    async $executeRaw() {
      throw new Error("SQL raw non disponibile con OPERATIONAL_BACKEND=firebase");
    },
    async $queryRawUnsafe() {
      throw new Error("SQL raw non disponibile con OPERATIONAL_BACKEND=firebase");
    },
    async $executeRawUnsafe() {
      throw new Error("SQL raw non disponibile con OPERATIONAL_BACKEND=firebase");
    },
  };

  return client as unknown as PrismaClient;
}

export function isFirebaseOperationalBackend() {
  return true;
}
