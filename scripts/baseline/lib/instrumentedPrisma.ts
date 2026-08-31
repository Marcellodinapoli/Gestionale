import type { PrismaClient } from "@prisma/client";
import { createFirebasePrisma } from "@/lib/firebase/firebasePrisma";
import {
  MODEL_RELATIONS,
  PRISMA_DELEGATE_TO_MODEL,
} from "@/lib/firebase/opsCollections";
import { planFirestoreQuery } from "@/lib/firebase/firestoreQuery";
import { globalMetrics, type ScanKind } from "./metrics";

export type CollectionSizes = Map<string, number>;

let collectionSizes: CollectionSizes = new Map();

function isOffline() {
  return process.env.BASELINE_OFFLINE === "1";
}

export function setCollectionSizes(sizes: CollectionSizes) {
  collectionSizes = sizes;
}

function modelSize(model: string): number {
  return collectionSizes.get(model) ?? 0;
}

function summarizeWhere(where: unknown): string {
  if (!where || typeof where !== "object") return "{}";
  try {
    const s = JSON.stringify(where, (_, v) => {
      if (v instanceof Date) return v.toISOString();
      return v;
    });
    return s.length > 200 ? `${s.slice(0, 197)}...` : s;
  } catch {
    return "[where]";
  }
}

function hasRelationFilter(where: unknown): boolean {
  if (!where || typeof where !== "object") return false;
  const w = where as Record<string, unknown>;
  for (const key of Object.keys(w)) {
    if (["AND", "OR", "NOT"].includes(key)) {
      const val = w[key];
      if (Array.isArray(val) && val.some((x) => hasRelationFilter(x))) return true;
      if (hasRelationFilter(val)) return true;
    }
    const expected = w[key];
    if (expected && typeof expected === "object" && !Array.isArray(expected)) {
      const e = expected as Record<string, unknown>;
      if ("contains" in e || "startsWith" in e) return true;
      if (!("equals" in e || "in" in e || "gte" in e || "gt" in e || "lte" in e || "lt" in e || "not" in e)) {
        if (!["id", "tenantId", "email", "slug"].includes(key)) return true;
      }
    }
  }
  return false;
}

function estimateReads(
  model: string,
  method: string,
  args: Record<string, unknown>,
  result: unknown,
  scanKind: ScanKind
): number {
  const size = modelSize(model);
  const rows = Array.isArray(result) ? result.length : result ? 1 : 0;

  switch (method) {
    case "aggregate":
    case "groupBy":
      return size;
    case "count":
      return scanKind === "indexed_query" ? 1 : size;
    case "findMany": {
      const take = typeof args.take === "number" ? args.take : undefined;
      if (scanKind === "full_collection_scan") return size;
      if (take != null) return Math.min(take, rows || take);
      return rows || size;
    }
    case "findUnique":
    case "findFirst":
      return scanKind === "full_collection_scan" ? size : 1;
    case "deleteMany":
    case "updateMany":
      return scanKind === "full_collection_scan" ? size + rows : rows;
    default:
      return rows || 1;
  }
}

function classifyOp(
  model: string,
  method: string,
  args: Record<string, unknown>
): ScanKind {
  if (method === "aggregate") return "aggregate";
  if (method === "groupBy") return "groupBy";
  if (method === "deleteMany") return "delete_many";

  const relations = MODEL_RELATIONS[model] || {};
  const where = args.where as Record<string, unknown> | undefined;

  if (hasRelationFilter(where)) return "relation_prefetch";

  if (method === "findUnique" || method === "findFirst") {
    if (where?.id) return "get_by_id";
    return "full_collection_scan";
  }

  if (method === "count" || method === "findMany") {
    const plan = planFirestoreQuery({
      where,
      orderBy: args.orderBy as Record<string, unknown> | Record<string, unknown>[] | undefined,
      take: typeof args.take === "number" ? args.take : undefined,
      skip: typeof args.skip === "number" ? args.skip : undefined,
      relations,
    });
    if (plan.pushed && !plan.residualWhere) return "indexed_query";
    if (method === "count") return "count_fallback";
    return "full_collection_scan";
  }

  return "unknown";
}

function estimateWrites(method: string, rowsReturned: number): number {
  switch (method) {
    case "create":
    case "update":
    case "delete":
    case "upsert":
      return 1;
    case "deleteMany":
    case "updateMany":
      return rowsReturned;
    case "createMany":
      return rowsReturned;
    default:
      return 0;
  }
}

/** In live mode prefer document counts returned by Firestore where available. */
function actualReads(
  method: string,
  scanKind: ScanKind,
  rowsReturned: number,
  fallback: number
): number {
  if (isOffline()) return fallback;
  if (method === "count" && scanKind === "indexed_query") return 1;
  if (method === "findUnique" || method === "findFirst") return rowsReturned > 0 ? 1 : 1;
  if (method === "findMany" || method === "groupBy") return rowsReturned > 0 ? rowsReturned : fallback;
  if (method === "aggregate" || method === "groupBy") return fallback;
  if (scanKind === "get_by_id") return 1;
  return fallback;
}

function mockResult(method: string, args: Record<string, unknown>) {
  switch (method) {
    case "count":
      return 0;
    case "findMany":
    case "groupBy":
      return [];
    case "findUnique":
    case "findFirst":
      return null;
    case "aggregate":
      return { _sum: { importo: 0 }, _count: 0 };
    case "create":
    case "update":
      return { id: "mock", ...(args.data as object) };
    case "deleteMany":
    case "updateMany":
      return { count: 0 };
    default:
      return null;
  }
}

function wrapDelegate(
  delegate: string,
  model: string,
  api: Record<string, (...a: unknown[]) => Promise<unknown>> | null
) {
  const wrapped: Record<string, (...a: unknown[]) => Promise<unknown>> = {};
  const methods = [
    "findMany", "findUnique", "findFirst", "count", "aggregate", "groupBy",
    "create", "update", "delete", "deleteMany", "updateMany", "createMany", "upsert",
  ];
  for (const method of methods) {
    const fn = api?.[method];
    wrapped[method] = async (...callArgs: unknown[]) => {
      const args = (callArgs[0] as Record<string, unknown>) || {};
      const scanKind = classifyOp(model, method, args);
      const t0 = performance.now();
      let result: unknown;
      let error: unknown;
      try {
        if (isOffline() || !fn) {
          result = mockResult(method, args);
        } else {
          result = await fn(...callArgs);
        }
      } catch (e) {
        error = e;
        result = null;
      }
      const durationMs = Math.round(performance.now() - t0);
      const rowsReturned = Array.isArray(result)
        ? result.length
        : result && typeof result === "object" && "count" in (result as object)
          ? Number((result as { count: number }).count)
          : result
            ? 1
            : 0;

      globalMetrics.record({
        delegate,
        method,
        model,
        durationMs,
        estimatedReads: actualReads(method, scanKind, rowsReturned, estimateReads(model, method, args, result, scanKind)),
        estimatedWrites: estimateWrites(method, rowsReturned),
        rowsReturned,
        scanKind,
        hasTake: typeof args.take === "number",
        hasSkip: typeof args.skip === "number",
        whereSummary: summarizeWhere(args.where),
      });

      if (error) throw error;
      return result;
    };
  }
  return wrapped;
}

let _client: PrismaClient | null = null;

export function getInstrumentedPrisma(): PrismaClient {
  if (!_client) {
    const raw = isOffline()
      ? null
      : (createFirebasePrisma() as unknown as Record<
          string,
          Record<string, (...a: unknown[]) => Promise<unknown>>
        >);
    const wrapped: Record<string, unknown> = {};
    for (const [delegate, model] of Object.entries(PRISMA_DELEGATE_TO_MODEL)) {
      wrapped[delegate] = wrapDelegate(delegate, model, raw?.[delegate] ?? null);
    }
    if (raw?.$connect) wrapped.$connect = raw.$connect.bind(raw);
    if (raw?.$disconnect) wrapped.$disconnect = raw.$disconnect.bind(raw);
    wrapped.$transaction = async (arg: unknown) => {
      if (typeof arg === "function") {
        return (arg as (c: PrismaClient) => unknown)(getInstrumentedPrisma());
      }
      if (Array.isArray(arg)) {
        const out = [];
        for (const p of arg) out.push(await p);
        return out;
      }
      throw new Error("$transaction non supportata");
    };
    _client = wrapped as unknown as PrismaClient;
  }
  return _client;
}

/** Drop-in sostituto di `@/lib/prisma` — solo per script baseline. */
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getInstrumentedPrisma() as unknown as Record<string | symbol, unknown>;
    const value = client[prop];
    if (typeof value === "function") return value.bind(client);
    return value;
  },
});
