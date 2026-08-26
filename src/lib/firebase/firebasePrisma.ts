/**
 * Backend operativo Credixa su Firestore.
 * API compatibile con i delegate Prisma usati dall'app.
 * Path: credixa/{tenantId}/{collection}/{id}
 *
 * Performance: cache per-richiesta, include in batch, getById mirati al tenant.
 */
import { randomBytes } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { getFirebaseFirestore } from "@/lib/firebase/admin";
import {
  MODEL_RELATIONS,
  PRISMA_DELEGATE_TO_MODEL,
  collectionForOpsModel,
} from "@/lib/firebase/opsCollections";
import {
  collectionCacheKey,
  docCacheKey,
  getFirebaseRequestCache,
  invalidateModelCache,
} from "@/lib/firebase/requestCache";
import {
  applyPlanToQuery,
  getDocsByIds,
  planFirestoreQuery,
  type Doc as FDoc,
} from "@/lib/firebase/firestoreQuery";
import { ttlGet, ttlInvalidateTenantModel, ttlSet } from "@/lib/firebase/ttlCache";

type Doc = Record<string, unknown>;

function cuidLike() {
  return `c${randomBytes(12).toString("hex")}`;
}

function reviveDates(doc: Doc, model?: string): Doc {
  const out: Doc = { ...doc };
  for (const [k, v] of Object.entries(out)) {
    if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v)) {
      const d = new Date(v);
      if (!Number.isNaN(d.getTime())) out[k] = d;
    }
  }
  delete out._credixaMirror;
  if (
    model &&
    (model === "Tenant" ||
      model === "User" ||
      model === "Sede" ||
      model === "Postazione" ||
      model === "Mandante") &&
    out.active === undefined
  ) {
    out.active = true;
  }
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
  const store = getFirebaseRequestCache();
  if (!store.tenantIds) {
    store.tenantIds = db
      .collection("credixa")
      .listDocuments()
      .then((roots) => roots.map((r) => r.id));
  }
  return store.tenantIds;
}

function indexCollection(model: string, tenantId: string | null | undefined, rows: Doc[]) {
  const store = getFirebaseRequestCache();
  const key = collectionCacheKey(model, tenantId);
  const byId = new Map<string, Doc>();
  for (const r of rows) byId.set(String(r.id), r);
  store.indexes.set(key, byId as Map<string, unknown>);
  // Propaga anche in docs cache
  for (const r of rows) {
    const id = String(r.id);
    store.docs.set(docCacheKey(model, id), Promise.resolve(r));
  }
}

async function loadCollectionUncached(model: string, tenantId?: string | null): Promise<Doc[]> {
  const col = collectionForOpsModel(model);
  if (!col) return [];
  const db = getFirebaseFirestore();

  if (model === "Tenant") {
    if (tenantId) {
      const snap = await db.doc(`credixa/${tenantId}/_meta/tenant`).get();
      if (!snap.exists) return [];
      return [reviveDates({ id: tenantId, ...(snap.data() as Doc) }, model)];
    }
    const ids = await listTenantIds(db);
    const snaps = await Promise.all(ids.map((id) => db.doc(`credixa/${id}/_meta/tenant`).get()));
    const rows: Doc[] = [];
    for (let i = 0; i < ids.length; i++) {
      const snap = snaps[i]!;
      if (!snap.exists) continue;
      rows.push(reviveDates({ id: ids[i], ...(snap.data() as Doc) }, model));
    }
    return rows;
  }

  if (tenantId) {
    const cached = ttlGet<Doc[]>(tenantId, model, "all");
    if (cached) return cached.map((r) => ({ ...r }));
    const snap = await db.collection(`credixa/${tenantId}/${col}`).get();
    const rows = snap.docs.map((d) =>
      reviveDates({ id: d.id, tenantId, ...(d.data() as Doc) }, model)
    );
    ttlSet(tenantId, model, rows, 12_000, "all");
    return rows;
  }

  const ids = await listTenantIds(db);
  const snaps = await Promise.all(ids.map((tid) => db.collection(`credixa/${tid}/${col}`).get()));
  const rows: Doc[] = [];
  for (let i = 0; i < ids.length; i++) {
    const tid = ids[i]!;
    for (const d of snaps[i]!.docs) {
      rows.push(reviveDates({ id: d.id, tenantId: tid, ...(d.data() as Doc) }, model));
    }
  }
  return rows;
}

async function loadCollection(model: string, tenantId?: string | null): Promise<Doc[]> {
  const store = getFirebaseRequestCache();
  const key = collectionCacheKey(model, tenantId);
  let pending = store.collections.get(key) as Promise<Doc[]> | undefined;
  if (!pending) {
    pending = loadCollectionUncached(model, tenantId).then((rows) => {
      indexCollection(model, tenantId, rows);
      return rows;
    });
    store.collections.set(key, pending);
  }
  return pending;
}

async function getById(model: string, id: string, tenantHint?: string | null): Promise<Doc | null> {
  if (!id) return null;
  const col = collectionForOpsModel(model);
  if (!col) return null;

  const store = getFirebaseRequestCache();
  const dKey = docCacheKey(model, id);
  const cached = store.docs.get(dKey) as Promise<Doc | null> | undefined;
  if (cached) return cached;

  // Indice collection già caricata
  if (tenantHint) {
    const idx = store.indexes.get(collectionCacheKey(model, tenantHint)) as Map<string, Doc> | undefined;
    if (idx?.has(id)) {
      const row = idx.get(id)!;
      store.docs.set(dKey, Promise.resolve(row));
      return row;
    }
  }
  const starIdx = store.indexes.get(collectionCacheKey(model, null)) as Map<string, Doc> | undefined;
  if (starIdx?.has(id)) {
    const row = starIdx.get(id)!;
    store.docs.set(dKey, Promise.resolve(row));
    return row;
  }

  const promise = (async (): Promise<Doc | null> => {
    const db = getFirebaseFirestore();

    if (model === "Tenant") {
      const snap = await db.doc(`credixa/${id}/_meta/tenant`).get();
      if (!snap.exists) return null;
      return reviveDates({ id, ...(snap.data() as Doc) }, model);
    }

    if (tenantHint) {
      const snap = await db.doc(`credixa/${tenantHint}/${col}/${id}`).get();
      if (snap.exists) {
        return reviveDates({ id, tenantId: tenantHint, ...(snap.data() as Doc) }, model);
      }
    }

    // Preferisci caricare la collection del tenant se già in cache via scan
    const ids = await listTenantIds(db);
    const snaps = await Promise.all(
      ids.map((tid) => db.doc(`credixa/${tid}/${col}/${id}`).get())
    );
    for (let i = 0; i < ids.length; i++) {
      const snap = snaps[i]!;
      if (snap.exists) {
        return reviveDates({ id, tenantId: ids[i], ...(snap.data() as Doc) }, model);
      }
    }
    return null;
  })();

  store.docs.set(dKey, promise);
  return promise;
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
    invalidateModelCache(model, id);
    return;
  }

  const tid = await resolveTenantId(row);
  if (!row.updatedAt) row.updatedAt = new Date();
  const payload = serializeForWrite({ ...row, id, tenantId: tid });
  await db.doc(`credixa/${tid}/${col}/${id}`).set(payload, { merge: true });
  invalidateModelCache(model, tid);
  ttlInvalidateTenantModel(tid, model);
  getFirebaseRequestCache().docs.delete(docCacheKey(model, id));
}

async function deleteDoc(model: string, row: Doc) {
  const col = collectionForOpsModel(model);
  if (!col) return;
  const db = getFirebaseFirestore();
  const id = String(row.id || "");
  if (model === "Tenant") {
    await db.doc(`credixa/${id}/_meta/tenant`).delete();
    invalidateModelCache(model, id);
    return;
  }
  let tid = String(row.tenantId || "");
  if (!tid) {
    const existing = await getById(model, id);
    tid = String(existing?.tenantId || "");
  }
  if (tid && id) await db.doc(`credixa/${tid}/${col}/${id}`).delete();
  invalidateModelCache(model, tid || null);
  if (tid) ttlInvalidateTenantModel(tid, model);
  getFirebaseRequestCache().docs.delete(docCacheKey(model, id));
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
  const tenantHint = typeof row.tenantId === "string" ? row.tenantId : undefined;

  for (const [key, expected] of Object.entries(where)) {
    if (key === "AND" || key === "OR" || key === "NOT") continue;

    if (key === "tenantId_email" && expected && typeof expected === "object") {
      const te = expected as Doc;
      if (String(row.tenantId) !== String(te.tenantId)) return false;
      if (String(row.email || "").toLowerCase() !== String(te.email || "").toLowerCase()) {
        return false;
      }
      continue;
    }
    if (key === "tenantId_nome" && expected && typeof expected === "object") {
      const tn = expected as Doc;
      if (String(row.tenantId) !== String(tn.tenantId)) return false;
      if (String(row.nome) !== String(tn.nome)) return false;
      continue;
    }
    if (key === "tenantId_codice" && expected && typeof expected === "object") {
      const tc = expected as Doc;
      if (String(row.tenantId) !== String(tc.tenantId)) return false;
      if (String(row.codice) !== String(tc.codice)) return false;
      continue;
    }
    if (key === "tenantId_numero" && expected && typeof expected === "object") {
      const tn = expected as Doc;
      if (String(row.tenantId) !== String(tn.tenantId)) return false;
      if (String(row.numero) !== String(tn.numero)) return false;
      continue;
    }
    if (key === "tenantId_chiave" && expected && typeof expected === "object") {
      const tk = expected as Doc;
      if (String(row.tenantId) !== String(tk.tenantId)) return false;
      if (String(row.chiave) !== String(tk.chiave)) return false;
      continue;
    }

    const rel = relations[key];
    if (rel && !rel.many) {
      const localVal = row[rel.local];
      if (localVal == null) {
        if (expected === null) continue;
        if (typeof expected === "object" && expected && (expected as Doc).equals === null) continue;
        return false;
      }
      // Precarica collection correlata (cache) invece di N getById ciechi
      if (tenantHint) await loadCollection(rel.model, tenantHint);
      const related = await getById(rel.model, String(localVal), tenantHint);
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
    if (!v) continue;
    if (typeof v === "object") {
      // Relazione nested: usa valore risolto, altrimenti null (mai undefined)
      out[k] = k in row ? row[k] : null;
      continue;
    }
    out[k] = row[k];
  }
  out.id = row.id;
  return out;
}

function relationArgsFromSelectOrInclude(
  model: string,
  select?: Doc,
  include?: Doc
): Doc | undefined {
  const relations = MODEL_RELATIONS[model] || {};
  const out: Doc = {};
  for (const src of [include, select]) {
    if (!src) continue;
    for (const [k, v] of Object.entries(src)) {
      if (!v) continue;
      if (k === "_count") {
        out._count = v;
        continue;
      }
      if (relations[k]) out[k] = v === true ? true : v;
    }
  }
  return Object.keys(out).length ? out : undefined;
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
      const toCmp = (x: unknown) => {
        if (x instanceof Date) return x.getTime();
        if (typeof x === "string" && /^\d{4}-\d{2}-\d{2}/.test(x)) {
          const t = new Date(x).getTime();
          if (!Number.isNaN(t)) return t;
        }
        return x;
      };
      const aCmp = toCmp(av);
      const bCmp = toCmp(bv);
      if ((aCmp as never) < (bCmp as never)) return dir === "desc" ? 1 : -1;
      if ((aCmp as never) > (bCmp as never)) return dir === "desc" ? -1 : 1;
    }
    return 0;
  });
}

async function resolveOneInclude(
  model: string,
  row: Doc,
  key: string,
  conf: unknown,
  relatedPool?: Map<string, Doc[]> | Map<string, Doc>
): Promise<unknown> {
  const relations = MODEL_RELATIONS[model] || {};
  const rel = relations[key];
  if (!rel) return undefined;

  const nestedInclude =
    typeof conf === "object" && conf && "include" in (conf as Doc)
      ? ((conf as Doc).include as Doc)
      : undefined;
  const nestedSelect =
    typeof conf === "object" && conf && "select" in (conf as Doc)
      ? ((conf as Doc).select as Doc)
      : undefined;

  if (rel.many) {
    const confObj = typeof conf === "object" && conf ? (conf as Doc) : {};
    const nestedWhere = "where" in confObj ? (confObj.where as Doc | undefined) : undefined;
    const nestedOrderBy =
      "orderBy" in confObj ? (confObj.orderBy as Doc | Doc[] | undefined) : undefined;
    const nestedTake = typeof confObj.take === "number" ? confObj.take : undefined;

    let related: Doc[];
    if (relatedPool instanceof Map && relatedPool.size >= 0) {
      const byFk = relatedPool as Map<string, Doc[]>;
      related = [...(byFk.get(String(row[rel.local])) || [])];
    } else {
      const all = await loadCollection(rel.model, row.tenantId as string | undefined);
      related = all.filter((r) => String(r[rel.foreign]) === String(row[rel.local]));
    }

    if (nestedWhere) {
      const filtered: Doc[] = [];
      for (const r of related) {
        if (await matchWhere(rel.model, r, nestedWhere)) filtered.push(r);
      }
      related = filtered;
    }
    related = sortRows(related, nestedOrderBy);
    if (nestedTake != null) related = related.slice(0, nestedTake);
    related = await Promise.all(
      related.map(async (r) => {
        let x = r;
        if (nestedInclude) x = await resolveIncludes(rel.model, x, nestedInclude);
        if (nestedSelect) x = applySelect(x, nestedSelect);
        return x;
      })
    );
    return related;
  }

  const localVal = row[rel.local];
  if (localVal == null) return null;
  let related: Doc | null = null;
  if (relatedPool instanceof Map) {
    const byId = relatedPool as Map<string, Doc>;
    related = byId.get(String(localVal)) || null;
  }
  if (!related) {
    related = await getById(rel.model, String(localVal), row.tenantId as string | undefined);
  }
  if (related) {
    if (nestedSelect) related = applySelect(related, nestedSelect);
    if (nestedInclude) related = await resolveIncludes(rel.model, related, nestedInclude);
  }
  return related;
}

async function resolveIncludes(model: string, row: Doc, include: Doc | undefined): Promise<Doc> {
  if (!include) return row;
  const out: Doc = { ...row };
  const keys = Object.keys(include).filter((k) => include[k] && k !== "_count");
  await Promise.all(
    keys.map(async (key) => {
      out[key] = await resolveOneInclude(model, row, key, include[key]);
    })
  );

  if (include._count) {
    const countConf = include._count as Doc;
    const select = (countConf.select || countConf) as Doc;
    const relations = MODEL_RELATIONS[model] || {};
    const counts: Doc = {};
    await Promise.all(
      Object.entries(select).map(async ([key, on]) => {
        if (!on) return;
        const rel = relations[key];
        if (!rel?.many) {
          counts[key] = 0;
          return;
        }
        const all = await loadCollection(rel.model, row.tenantId as string | undefined);
        counts[key] = all.filter((r) => String(r[rel.foreign]) === String(row[rel.local])).length;
      })
    );
    out._count = counts;
  }

  return out;
}

/** Risolve include per N righe: solo docs degli ID necessari (getAll), non collection intere. */
async function resolveIncludesBatch(
  model: string,
  rows: Doc[],
  include: Doc | undefined
): Promise<Doc[]> {
  if (!include || !rows.length) {
    if (!include) return rows;
    return Promise.all(rows.map((r) => resolveIncludes(model, r, include)));
  }

  const relations = MODEL_RELATIONS[model] || {};
  const tenantHint = rows.find((r) => typeof r.tenantId === "string")?.tenantId as
    | string
    | undefined;
  const db = getFirebaseFirestore();

  type RelPlan = {
    key: string;
    conf: unknown;
    rel: { model: string; local: string; foreign: string; many?: boolean };
  };
  const plans: RelPlan[] = [];
  for (const [key, conf] of Object.entries(include)) {
    if (!conf || key === "_count") continue;
    const rel = relations[key];
    if (rel) plans.push({ key, conf, rel });
  }

  // Pool many solo per `_count` (senza attaccare le liste al risultato)
  const countOnlyPlans: RelPlan[] = [];
  if (include._count) {
    const countConf = include._count as Doc;
    const select = (countConf.select || countConf) as Doc;
    for (const [key, on] of Object.entries(select)) {
      if (!on || plans.some((p) => p.key === key)) continue;
      const rel = relations[key];
      if (rel?.many) countOnlyPlans.push({ key, conf: true, rel });
    }
  }

  const manyPools = new Map<string, Map<string, Doc[]>>();
  const onePools = new Map<string, Map<string, Doc>>();

  await Promise.all(
    [...plans, ...countOnlyPlans].map(async ({ key, rel }) => {
      const colName = collectionForOpsModel(rel.model);
      if (!colName || !tenantHint) {
        // Fallback legacy
        if (rel.many) {
          const all = await loadCollection(rel.model, tenantHint);
          const byFk = new Map<string, Doc[]>();
          for (const r of all) {
            const fk = String(r[rel.foreign] ?? "");
            if (!byFk.has(fk)) byFk.set(fk, []);
            byFk.get(fk)!.push(r);
          }
          manyPools.set(key, byFk);
        } else {
          const ids = [...new Set(rows.map((r) => r[rel.local]).filter(Boolean).map(String))];
          const byId = await getDocsByIds(db, tenantHint || "", colName || "x", ids, (d) =>
            reviveDates(d, rel.model)
          );
          onePools.set(key, byId);
        }
        return;
      }

      if (rel.many) {
        const parentIds = [...new Set(rows.map((r) => String(r[rel.local] ?? "")).filter(Boolean))];
        const byFk = new Map<string, Doc[]>();
        // Query where foreign in parentIds (chunk 30)
        for (let i = 0; i < parentIds.length; i += 30) {
          const chunk = parentIds.slice(i, i + 30);
          if (!chunk.length) continue;
          const confObj = typeof plans.find((p) => p.key === key)?.conf === "object"
            ? (plans.find((p) => p.key === key)!.conf as Doc)
            : {};
          const nestedTake = typeof confObj.take === "number" ? confObj.take : undefined;
          let q: FirebaseFirestore.Query = db
            .collection(`credixa/${tenantHint}/${colName}`)
            .where(rel.foreign, "in", chunk);
          // Per take:1 orderBy createdAt desc — solo se richiesto
          if (
            nestedTake === 1 &&
            confObj.orderBy &&
            typeof confObj.orderBy === "object" &&
            !Array.isArray(confObj.orderBy)
          ) {
            const [f, d] = Object.entries(confObj.orderBy as Doc)[0] || [];
            if (f && (d === "asc" || d === "desc")) {
              try {
                q = q.orderBy(f, d);
              } catch {
                /* index missing — senza order */
              }
            }
          }
          try {
            const snap = await q.get();
            for (const doc of snap.docs) {
              const row = reviveDates(
                { id: doc.id, tenantId: tenantHint, ...(doc.data() as Doc) },
                rel.model
              );
              const fk = String(row[rel.foreign] ?? "");
              if (!byFk.has(fk)) byFk.set(fk, []);
              byFk.get(fk)!.push(row);
            }
          } catch {
            // Indice mancante: fallback get per parent (ancora meglio del full scan globale)
            for (const pid of chunk) {
              const snap = await db
                .collection(`credixa/${tenantHint}/${colName}`)
                .where(rel.foreign, "==", pid)
                .limit(nestedTake ?? 50)
                .get();
              for (const doc of snap.docs) {
                const row = reviveDates(
                  { id: doc.id, tenantId: tenantHint, ...(doc.data() as Doc) },
                  rel.model
                );
                const fk = String(row[rel.foreign] ?? "");
                if (!byFk.has(fk)) byFk.set(fk, []);
                byFk.get(fk)!.push(row);
              }
            }
          }
        }
        manyPools.set(key, byFk);
      } else {
        const ids = [...new Set(rows.map((r) => r[rel.local]).filter((v) => v != null).map(String))];
        const byId = await getDocsByIds(db, tenantHint, colName, ids, (d) =>
          reviveDates(d, rel.model)
        );
        onePools.set(key, byId);
      }
    })
  );

  return Promise.all(
    rows.map(async (row) => {
      const out: Doc = { ...row };
      await Promise.all(
        plans.map(async ({ key, conf, rel }) => {
          const pool = rel.many ? manyPools.get(key) : onePools.get(key);
          out[key] = await resolveOneInclude(model, row, key, conf, pool);
        })
      );

      if (include._count) {
        const countConf = include._count as Doc;
        const select = (countConf.select || countConf) as Doc;
        const counts: Doc = {};
        for (const [ckey, on] of Object.entries(select)) {
          if (!on) continue;
          const rel = relations[ckey];
          if (!rel?.many) {
            counts[ckey] = 0;
            continue;
          }
          const pool = manyPools.get(ckey);
          counts[ckey] = pool ? (pool.get(String(row[rel.local])) || []).length : 0;
        }
        out._count = counts;
      }
      return out;
    })
  );
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
  // Nested relation filters (es. pratica: { tenantId })
  for (const [k, v] of Object.entries(where)) {
    if (k === "AND" || k === "OR" || k === "NOT") continue;
    if (v && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date)) {
      const t = extractTenantHint(v as Doc);
      if (t) return t;
    }
  }
  return undefined;
}

/** Pre-carica relazioni usate nel where (es. User per filtro supervisor). */
async function prefetchWhereRelations(model: string, where: Doc | undefined, tenantHint?: string) {
  if (!where) return;
  const relations = MODEL_RELATIONS[model] || {};
  const models = new Set<string>();
  const walk = (w: Doc) => {
    if (Array.isArray(w.AND)) (w.AND as Doc[]).forEach(walk);
    if (Array.isArray(w.OR)) (w.OR as Doc[]).forEach(walk);
    if (w.NOT) {
      if (Array.isArray(w.NOT)) (w.NOT as Doc[]).forEach(walk);
      else walk(w.NOT as Doc);
    }
    for (const key of Object.keys(w)) {
      const rel = relations[key];
      if (rel && !rel.many) models.add(rel.model);
    }
  };
  walk(where);
  await Promise.all([...models].map((m) => loadCollection(m, tenantHint)));
}

function createDelegate(model: string) {
  const api = {
    async findUnique(args: { where: Doc; include?: Doc; select?: Doc }) {
      const where = args.where || {};
      let row: Doc | null = null;
      const tenantHint = extractTenantHint(where);
      if (typeof where.id === "string") row = await getById(model, where.id, tenantHint);
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
        const all = await loadCollection(model, tenantHint);
        row = all.find((r) => String(r.praticaId) === String(where.praticaId)) || null;
      } else if (where.incassoId && model === "Provvigione") {
        const all = await loadCollection(model, tenantHint);
        row = all.find((r) => String(r.incassoId) === String(where.incassoId)) || null;
      } else {
        await prefetchWhereRelations(model, where, tenantHint);
        const all = await loadCollection(model, tenantHint);
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
      const relArgs = relationArgsFromSelectOrInclude(model, args.select, args.include);
      if (relArgs) out = await resolveIncludes(model, out, relArgs);
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
      const tenantHint = extractTenantHint(args.where);
      const relations = MODEL_RELATIONS[model] || {};
      const col = collectionForOpsModel(model);

      // id in [...] → getAll mirato (no full scan)
      const idIn = args.where?.id;
      if (
        tenantHint &&
        col &&
        idIn &&
        typeof idIn === "object" &&
        Array.isArray((idIn as Doc).in)
      ) {
        const ids = ((idIn as Doc).in as unknown[]).map(String);
        const db = getFirebaseFirestore();
        const byId = await getDocsByIds(db, tenantHint, col, ids, (d) => reviveDates(d, model));
        let rows = ids.map((id) => byId.get(id)!).filter(Boolean);
        for (const r of [...rows]) {
          if (!(await matchWhere(model, r, args.where))) {
            rows = rows.filter((x) => x.id !== r.id);
          }
        }
        rows = sortRows(rows, args.orderBy);
        if (args.skip) rows = rows.slice(args.skip);
        if (args.take != null) rows = rows.slice(0, args.take);
        const relArgs = relationArgsFromSelectOrInclude(model, args.select, args.include);
        if (relArgs) rows = await resolveIncludesBatch(model, rows, relArgs);
        if (args.select) {
          rows = rows.map((r) => {
            const selected = applySelect(r, args.select);
            for (const [k, v] of Object.entries(args.select!)) {
              if (!v || typeof v !== "object") continue;
              selected[k] = r[k] ?? null;
            }
            return selected;
          });
        }
        return rows;
      }

      await prefetchWhereRelations(model, args.where, tenantHint);

      const plan = planFirestoreQuery({
        where: args.where as FDoc | undefined,
        orderBy: args.orderBy as FDoc | FDoc[] | undefined,
        take: args.take,
        skip: args.skip,
        relations,
      });

      let rows: Doc[] = [];
      let usedFirestoreQuery = false;

      if (tenantHint && col && model !== "Tenant" && (plan.pushed || plan.limit != null)) {
        const db = getFirebaseFirestore();
        try {
          const base = db.collection(`credixa/${tenantHint}/${col}`);
          const q = applyPlanToQuery(base, plan);
          const snap = await q.get();
          rows = snap.docs.map((d) =>
            reviveDates({ id: d.id, tenantId: tenantHint, ...(d.data() as Doc) }, model)
          );
          usedFirestoreQuery = true;
        } catch {
          usedFirestoreQuery = false;
        }
      }

      if (!usedFirestoreQuery) {
        rows = await loadCollection(model, tenantHint);
      }

      // Applica residual / where completo solo se serve
      if (!usedFirestoreQuery || plan.residualWhere) {
        const filtered: Doc[] = [];
        for (const r of rows) {
          if (await matchWhere(model, r, args.where)) filtered.push(r);
        }
        rows = filtered;
      }

      if (!usedFirestoreQuery || !plan.orderBy) {
        rows = sortRows(rows, args.orderBy);
      }
      if (args.distinct?.length) {
        const seen = new Set<string>();
        rows = rows.filter((r) => {
          const key = args.distinct!.map((f) => String(r[f])).join("|");
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      }

      if (usedFirestoreQuery && plan.sliceSkip) {
        rows = rows.slice(plan.sliceSkip);
      } else if (!usedFirestoreQuery || plan.residualWhere) {
        // Limit Firestore non applicabile con residual: slice in memoria
        if (args.skip) rows = rows.slice(args.skip);
        if (args.take != null) rows = rows.slice(0, args.take);
      } else if (args.take != null && plan.limit == null) {
        if (args.skip) rows = rows.slice(args.skip);
        rows = rows.slice(0, args.take);
      }

      const relArgs = relationArgsFromSelectOrInclude(model, args.select, args.include);
      if (relArgs) {
        rows = await resolveIncludesBatch(model, rows, relArgs);
      }
      if (args.select) {
        rows = rows.map((r) => {
          const selected = applySelect(r, args.select);
          for (const [k, v] of Object.entries(args.select!)) {
            if (!v || typeof v !== "object") continue;
            selected[k] = r[k] ?? null;
          }
          return selected;
        });
      }
      return rows;
    },

    async create(args: { data: Doc; include?: Doc }) {
      const data = { ...args.data };
      if (!data.id) data.id = cuidLike();
      if (!data.createdAt) data.createdAt = new Date();
      if (
        (model === "Tenant" ||
          model === "User" ||
          model === "Sede" ||
          model === "Postazione" ||
          model === "Mandante") &&
        data.active === undefined
      ) {
        data.active = true;
      }
      await saveDoc(model, data);
      let row = (await getById(model, String(data.id), data.tenantId as string | undefined)) || data;
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
      let row =
        (await getById(model, String(existing.id), existing.tenantId as string | undefined)) ||
        merged;
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
      const tenantHint = extractTenantHint(args.where);
      const relations = MODEL_RELATIONS[model] || {};
      const col = collectionForOpsModel(model);
      const plan = planFirestoreQuery({
        where: args.where as FDoc | undefined,
        relations,
      });

      // Count aggregation Firestore quando where è interamente pushable
      if (tenantHint && col && model !== "Tenant" && !plan.residualWhere) {
        const db = getFirebaseFirestore();
        try {
          const base = db.collection(`credixa/${tenantHint}/${col}`);
          const q = applyPlanToQuery(base, { ...plan, limit: undefined, orderBy: undefined });
          const agg = await q.count().get();
          return agg.data().count;
        } catch {
          /* fallback */
        }
      }

      await prefetchWhereRelations(model, args.where, tenantHint);
      const rows = await loadCollection(model, tenantHint);
      let n = 0;
      for (const r of rows) {
        if (await matchWhere(model, r, args.where)) n++;
      }
      return n;
    },

    async createMany(args: { data: Doc[] }) {
      for (const d of args.data) await api.create({ data: d });
      return { count: args.data.length };
    },

    async aggregate(args: { where?: Doc; _sum?: Doc; _avg?: Doc; _count?: boolean | Doc }) {
      const tenantHint = extractTenantHint(args.where);
      await prefetchWhereRelations(model, args.where, tenantHint);
      const all = await loadCollection(model, tenantHint);
      const rows: Doc[] = [];
      for (const r of all) {
        if (await matchWhere(model, r, args.where)) rows.push(r);
      }
      const result: Doc = {};
      // Sempre numero: l'UI renderizza `_count` direttamente
      if (args._count) result._count = rows.length;
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
      const tenantHint = extractTenantHint(args.where);
      await prefetchWhereRelations(model, args.where, tenantHint);
      const all = await loadCollection(model, tenantHint);
      const rows: Doc[] = [];
      for (const r of all) {
        if (await matchWhere(model, r, args.where)) rows.push(r);
      }
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
        if (args._count) row._count = group.length;
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
