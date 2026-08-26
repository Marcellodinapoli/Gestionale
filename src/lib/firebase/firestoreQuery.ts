/**
 * Pianificazione query Firestore: spinge where/orderBy/limit quando possibile.
 * Filtri non pushable restano in-memory (mai cross-tenant: serve sempre tenantId).
 */
import type {
  CollectionReference,
  DocumentData,
  Query,
  Firestore,
} from "firebase-admin/firestore";

export type Doc = Record<string, unknown>;

export type FirestoreConstraint =
  | { type: "eq"; field: string; value: unknown }
  | { type: "in"; field: string; values: unknown[] }
  | { type: "neq"; field: string; value: unknown }
  | { type: "gt" | "gte" | "lt" | "lte"; field: string; value: unknown }
  | { type: "notNull"; field: string };

export type QueryPlan = {
  /** Constraint pushable su Firestore (stesso path tenant). */
  constraints: FirestoreConstraint[];
  /** Residuo where da applicare in memoria (AND di pezzi non pushati). */
  residualWhere: Doc | undefined;
  /** true se abbiamo spinto almeno un filtro utile oltre al path. */
  pushed: boolean;
  /** orderBy singolo campo scalare pushable. */
  orderBy?: { field: string; dir: "asc" | "desc" };
  /** Quanti doc leggere al max (skip+take o take). */
  limit?: number;
  /** true se skip>0 e abbiamo usato limit(skip+take) — slice dopo. */
  sliceSkip?: number;
};

const RELATION_KEYS = new Set([
  "AND",
  "OR",
  "NOT",
  "tenantId_email",
  "tenantId_nome",
  "tenantId_codice",
  "tenantId_numero",
  "tenantId_chiave",
]);

function isPlainObject(v: unknown): v is Doc {
  return typeof v === "object" && v !== null && !Array.isArray(v) && !(v instanceof Date);
}

function serializeValue(v: unknown): unknown {
  if (v instanceof Date) return v; // Admin SDK accetta Date
  return v;
}

/** Estrae filtri uguaglianza/range/`in`/`not null` da un where piatto (no OR/relation). */
function extractFlatConstraints(
  where: Doc,
  relations: Record<string, unknown>
): { constraints: FirestoreConstraint[]; residual: Doc } {
  const constraints: FirestoreConstraint[] = [];
  const residual: Doc = {};

  for (const [key, expected] of Object.entries(where)) {
    if (RELATION_KEYS.has(key)) {
      residual[key] = expected;
      continue;
    }
    if (key in relations) {
      residual[key] = expected;
      continue;
    }

    if (expected === null) {
      // Firestore: campo assente ≠ null; gestiamo in memoria
      residual[key] = expected;
      continue;
    }

    if (!isPlainObject(expected)) {
      constraints.push({ type: "eq", field: key, value: serializeValue(expected) });
      continue;
    }

    if ("equals" in expected) {
      if (expected.equals === null) {
        residual[key] = expected;
      } else {
        constraints.push({ type: "eq", field: key, value: serializeValue(expected.equals) });
      }
      continue;
    }
    if ("in" in expected && Array.isArray(expected.in)) {
      const vals = (expected.in as unknown[]).map(serializeValue);
      if (vals.length === 0) {
        residual[key] = expected;
      } else if (vals.length <= 30) {
        constraints.push({ type: "in", field: key, values: vals });
      } else {
        // Chunk in-memory dopo query più ampia, o residual
        residual[key] = expected;
      }
      continue;
    }
    if ("not" in expected) {
      if (expected.not === null) {
        constraints.push({ type: "notNull", field: key });
      } else {
        constraints.push({ type: "neq", field: key, value: serializeValue(expected.not) });
      }
      continue;
    }

    const rangeOps = ["gte", "gt", "lte", "lt"] as const;
    const hasRange = rangeOps.some((op) => op in expected);
    if (hasRange) {
      for (const op of rangeOps) {
        if (op in expected) {
          constraints.push({
            type: op,
            field: key,
            value: serializeValue(expected[op]),
          });
        }
      }
      // Altri operatori sullo stesso campo → residual
      for (const k of Object.keys(expected)) {
        if (!rangeOps.includes(k as (typeof rangeOps)[number]) && k !== "equals") {
          residual[key] = expected;
          break;
        }
      }
      continue;
    }

    // contains / startsWith → residual (no index full-text)
    residual[key] = expected;
  }

  return { constraints, residual };
}

/**
 * Appiattisce AND di pezzi semplici; se c'è OR/NOT/relation nested → residual intero.
 */
export function planFirestoreQuery(args: {
  where?: Doc;
  orderBy?: Doc | Doc[];
  take?: number;
  skip?: number;
  relations: Record<string, unknown>;
}): QueryPlan {
  const { where, orderBy, take, skip, relations } = args;
  let constraints: FirestoreConstraint[] = [];
  let residualWhere: Doc | undefined;

  if (where && Object.keys(where).length) {
    if (Array.isArray(where.AND) && !where.OR && !where.NOT) {
      const residualParts: Doc[] = [];
      for (const part of where.AND as Doc[]) {
        if (part.OR || part.NOT || part.AND) {
          residualParts.push(part);
          continue;
        }
        const hasRel = Object.keys(part).some((k) => k in relations);
        if (hasRel) {
          residualParts.push(part);
          continue;
        }
        const { constraints: c, residual } = extractFlatConstraints(part, relations);
        constraints.push(...c);
        if (Object.keys(residual).length) residualParts.push(residual);
      }
      if (residualParts.length) {
        residualWhere = residualParts.length === 1 ? residualParts[0] : { AND: residualParts };
      }
    } else if (!where.OR && !where.NOT && !where.AND) {
      const hasRel = Object.keys(where).some((k) => k in relations);
      if (hasRel) {
        residualWhere = where;
      } else {
        const { constraints: c, residual } = extractFlatConstraints(where, relations);
        constraints = c;
        if (Object.keys(residual).length) residualWhere = residual;
      }
    } else {
      residualWhere = where;
    }
  }

  let order: QueryPlan["orderBy"];
  if (orderBy) {
    const first = Array.isArray(orderBy) ? orderBy[0] : orderBy;
    if (first) {
      const [field, dir] = Object.entries(first)[0] || [];
      if (field && (dir === "asc" || dir === "desc") && !(field in relations)) {
        // Solo se non c'è orderBy nested relation
        order = { field, dir };
      }
    }
  }

  // Se residual complesso, non possiamo fidarci di limit Firestore (sotto-conteggio).
  // Eccezione: residual assente → limit reale.
  const canLimit = !residualWhere;
  let limit: number | undefined;
  let sliceSkip: number | undefined;
  if (canLimit && take != null) {
    const sk = skip || 0;
    limit = sk + take;
    if (sk > 0) sliceSkip = sk;
  } else if (canLimit && take == null && skip) {
    // skip without take: non pushare limit infinito
  }

  return {
    constraints,
    residualWhere,
    pushed: constraints.length > 0 || Boolean(order) || Boolean(limit && canLimit),
    orderBy: order,
    limit: canLimit ? limit : undefined,
    sliceSkip,
  };
}

export function applyPlanToQuery(
  base: CollectionReference<DocumentData> | Query<DocumentData>,
  plan: QueryPlan
): Query<DocumentData> {
  let q: Query<DocumentData> = base;

  // Firestore: inequality/range su un solo campo; neq/notNull contano come inequality
  const inequalityFields = new Set<string>();
  for (const c of plan.constraints) {
    if (c.type === "gt" || c.type === "gte" || c.type === "lt" || c.type === "lte" || c.type === "neq" || c.type === "notNull") {
      inequalityFields.add(c.field);
    }
  }
  if (inequalityFields.size > 1) {
    // Non applicare inequality multiple — lascia tutto al residual via full scan path
    return base;
  }

  for (const c of plan.constraints) {
    switch (c.type) {
      case "eq":
        q = q.where(c.field, "==", c.value);
        break;
      case "in":
        q = q.where(c.field, "in", c.values);
        break;
      case "neq":
        q = q.where(c.field, "!=", c.value);
        break;
      case "gt":
        q = q.where(c.field, ">", c.value);
        break;
      case "gte":
        q = q.where(c.field, ">=", c.value);
        break;
      case "lt":
        q = q.where(c.field, "<", c.value);
        break;
      case "lte":
        q = q.where(c.field, "<=", c.value);
        break;
      case "notNull":
        // Campo deve esistere: in Firestore != null
        q = q.where(c.field, "!=", null);
        break;
    }
  }

  if (plan.orderBy) {
    // Se inequality su altro campo, orderBy deve iniziare da quel campo — semplifichiamo:
    const ineq = [...inequalityFields][0];
    if (ineq && ineq !== plan.orderBy.field) {
      q = q.orderBy(ineq, "asc").orderBy(plan.orderBy.field, plan.orderBy.dir);
    } else {
      q = q.orderBy(plan.orderBy.field, plan.orderBy.dir);
    }
  } else if (inequalityFields.size === 1) {
    // Firestore richiede orderBy sul campo inequality
    q = q.orderBy([...inequalityFields][0]!, "asc");
  }

  if (plan.limit != null && plan.limit > 0) {
    q = q.limit(plan.limit);
  }

  return q;
}

/** Firestore `in` max 30 — chunk getAll-style queries. */
export async function getDocsByIds(
  db: Firestore,
  tenantId: string,
  collectionName: string,
  ids: string[],
  revive: (data: Doc, id: string) => Doc
): Promise<Map<string, Doc>> {
  const out = new Map<string, Doc>();
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return out;

  const refs = unique.map((id) => db.doc(`credixa/${tenantId}/${collectionName}/${id}`));
  // getAll max ~100 per call tipicamente ok fino a centinaia
  for (let i = 0; i < refs.length; i += 100) {
    const chunk = refs.slice(i, i + 100);
    const snaps = await db.getAll(...chunk);
    for (const snap of snaps) {
      if (!snap.exists) continue;
      const id = snap.id;
      out.set(id, revive({ id, tenantId, ...(snap.data() as Doc) }, id));
    }
  }
  return out;
}
