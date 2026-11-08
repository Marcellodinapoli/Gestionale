import "server-only";
import { randomUUID } from "crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { PoolClient } from "@neondatabase/serverless";
import { neonQuery, getNeonPool } from "@/lib/neon/pool";
import { mapSqlRow } from "@/lib/data/mapSqlRow";
import type { SessionUser } from "@/lib/permissions";
export type DialerDbContext = { tenantId: string; user?: SessionUser };

export type DialerDb = {
  dialerCampagna: typeof prisma.dialerCampagna;
  dialerCampagnaOperatore: typeof prisma.dialerCampagnaOperatore;
  dialerCampagnaPratica: typeof prisma.dialerCampagnaPratica;
  dialerChiamataEvento: typeof prisma.dialerChiamataEvento;
  $transaction: <T>(fn: (tx: DialerDb) => Promise<T>) => Promise<T>;
};

const DATE_KEYS = new Set([
  "createdAt",
  "updatedAt",
  "activatedAt",
  "invitatoAt",
  "accettatoAt",
  "pausaInizioAt",
  "uscitaAt",
  "postCallFineAt",
  "lastHeartbeatAt",
  "ultimaChiamataAt",
  "prossimoTentativoAt",
  "lockedAt",
]);

function hydrateDates(row: Record<string, unknown>): Record<string, unknown> {
  const out = { ...row };
  for (const key of DATE_KEYS) {
    const v = out[key];
    if (typeof v === "string") out[key] = new Date(v);
  }
  return out;
}

function mapRow(row: Record<string, unknown>): Record<string, unknown> {
  return hydrateDates(mapSqlRow(row));
}

/** Confronto id compatibile con colonne text (legacy SQL Server) o uuid su Neon. */
function eqId(column: string, paramIndex: number): string {
  return `${column}::text = $${paramIndex}::text`;
}

function eqIdAny(column: string, paramIndex: number): string {
  return `${column}::text = ANY($${paramIndex}::text[])`;
}

function joinId(left: string, right: string): string {
  return `${left}::text = ${right}::text`;
}

function campagnaSelectSql(alias = "c"): string {
  return `${alias}."Id", ${alias}."TenantId", ${alias}."Nome", ${alias}."Descrizione", ${alias}."CodiciScarico",
    ${alias}."PostCallSec", ${alias}."LockTimeoutSec", ${alias}."Stato", ${alias}."PacingRatio", ${alias}."ExternalId",
    ${alias}."CreatedById", ${alias}."SupervisorId", ${alias}."CreatedAt", ${alias}."UpdatedAt", ${alias}."ActivatedAt"`;
}

function scopeSqlForUser(user: SessionUser): { sql: string; params: unknown[] } {
  const params: unknown[] = [user.tenantId];
  let sql = eqId(`c."TenantId"`, 1);
  if (user.role === "ADMIN") return { sql, params };
  if (user.role === "SUPERVISOR") {
    params.push(user.id);
    const u = params.length;
    sql += ` AND (
      ${eqId(`c."SupervisorId"`, u)} OR ${eqId(`c."CreatedById"`, u)} OR EXISTS (
        SELECT 1 FROM "DialerCampagnaOperatori" dco
        INNER JOIN "Users" u ON ${joinId(`u."Id"`, `dco."OperatoreId"`)}
        WHERE dco."CampagnaId" = c."Id" AND ${eqId(`u."SupervisorId"`, u)}
      )
    )`;
    return { sql, params };
  }
  sql += ` AND FALSE`;
  return { sql, params };
}

function whereCampagnaFromPrisma(
  where: Prisma.DialerCampagnaWhereInput | undefined,
  ctx: DialerDbContext
): { sql: string; params: unknown[] } {
  const params: unknown[] = [];
  const clauses: string[] = [];
  const w = where ?? {};
  if (typeof w.id === "string") {
    params.push(w.id);
    clauses.push(`c."Id" = $${params.length}`);
  }
  if (typeof w.tenantId === "string") {
    params.push(w.tenantId);
    clauses.push(eqId(`c."TenantId"`, params.length));
  } else if (ctx.tenantId) {
    params.push(ctx.tenantId);
    clauses.push(eqId(`c."TenantId"`, params.length));
  }
  if (typeof w.stato === "string") {
    params.push(w.stato);
    clauses.push(`c."Stato" = $${params.length}`);
  }
  if (!clauses.length) clauses.push("TRUE");
  return { sql: clauses.join(" AND "), params };
}

async function safeRollback(client: PoolClient) {
  try {
    await client.query("ROLLBACK");
  } catch {
    /* connessione già in stato inconsistente */
  }
}

async function runTx<T>(fn: (db: DialerDb) => Promise<T>, ctx: DialerDbContext): Promise<T> {
  const pool = getNeonPool();
  const client = await pool.connect();
  let committed = false;
  const query = async (text: string, params: unknown[] = []) => {
    const res = await client.query(text, params);
    return res.rows;
  };
  try {
    await client.query("BEGIN");
    const txDb = createNeonDialerDb(ctx, query);
    const result = await fn(txDb);
    await client.query("COMMIT");
    committed = true;
    return result;
  } catch (e) {
    await safeRollback(client);
    throw e;
  } finally {
    if (committed) client.release();
    else client.release(true);
  }
}

type QueryFn = (text: string, params?: unknown[]) => Promise<Record<string, unknown>[]>;

export function createNeonDialerDb(ctx: DialerDbContext, queryFn?: QueryFn): DialerDb {
  const query = queryFn ?? ((text, params) => neonQuery(text, params ?? []));

  const dialerCampagna = {
    async findFirst(args: Prisma.DialerCampagnaFindFirstArgs) {
      const { sql, params } = whereCampagnaFromPrisma(args.where, ctx);
      const rows = await query(
        `SELECT ${campagnaSelectSql()} FROM "DialerCampagne" c WHERE ${sql} LIMIT 1`,
        params
      );
      if (!rows[0]) return null;
      const row = mapRow(rows[0]);
      const include = args.include as {
        operatori?: { include?: { operatore?: { select?: { name?: boolean } } } };
        _count?: { select?: { pratiche?: boolean; eventi?: boolean; operatori?: boolean } };
      } | undefined;
      if (include?.operatori) {
        const ops = await findOperatoriMany(
          {
            where: { campagnaId: String(row.id) },
            include: include.operatori.include ?? undefined,
          },
          query
        );
        (row as Record<string, unknown>).operatori = ops;
      }
      if (include?._count?.select) {
        const counts = include._count.select;
        const countRow = await query(
          `SELECT
            (SELECT COUNT(*)::int FROM "DialerCampagnaOperatori" o WHERE o."CampagnaId" = $1) AS "OperatoriCount",
            (SELECT COUNT(*)::int FROM "DialerCampagnaPratiche" p WHERE p."CampagnaId" = $1) AS "PraticheCount",
            (SELECT COUNT(*)::int FROM "DialerChiamataEventi" e WHERE e."CampagnaId" = $1) AS "EventiCount"`,
          [row.id]
        );
        const c = countRow[0] ?? {};
        (row as Record<string, unknown>)._count = {
          ...(counts.operatori ? { operatori: Number(c.OperatoriCount ?? 0) } : {}),
          ...(counts.pratiche ? { pratiche: Number(c.PraticheCount ?? 0) } : {}),
          ...(counts.eventi ? { eventi: Number(c.EventiCount ?? 0) } : {}),
        };
      }
      return row;
    },

    async findMany(args: Prisma.DialerCampagnaFindManyArgs) {
      const where = args.where as Prisma.DialerCampagnaWhereInput | undefined;
      let scopeSql: string;
      let params: unknown[];

      const includeCount =
        args.include &&
        typeof args.include === "object" &&
        "_count" in (args.include as object);

      if (ctx.user && needsUserScope(where)) {
        const scoped = scopeSqlForUser(ctx.user);
        scopeSql = scoped.sql;
        params = scoped.params;
      } else {
        const built = whereCampagnaFromPrisma(where, ctx);
        scopeSql = built.sql;
        params = built.params;
      }

      const order =
        args.orderBy && typeof args.orderBy === "object" && "updatedAt" in args.orderBy
          ? `ORDER BY c."UpdatedAt" DESC`
          : "";

      if (includeCount) {
        const rows = await query(
          `SELECT ${campagnaSelectSql()},
            (SELECT COUNT(*)::int FROM "DialerCampagnaOperatori" o WHERE o."CampagnaId" = c."Id") AS "OperatoriCount",
            (SELECT COUNT(*)::int FROM "DialerCampagnaPratiche" p WHERE p."CampagnaId" = c."Id") AS "PraticheCount",
            (SELECT COUNT(*)::int FROM "DialerChiamataEventi" e WHERE e."CampagnaId" = c."Id") AS "EventiCount"
           FROM "DialerCampagne" c
           WHERE ${scopeSql}
           ${order}`,
          params
        );
        return rows.map((r) => {
          const m = mapRow(r);
          return {
            ...m,
            _count: {
              operatori: Number(r.OperatoriCount ?? 0),
              pratiche: Number(r.PraticheCount ?? 0),
              eventi: Number(r.EventiCount ?? 0),
            },
          };
        });
      }

      const rows = await query(
        `SELECT ${campagnaSelectSql()} FROM "DialerCampagne" c WHERE ${scopeSql} ${order}`,
        params
      );
      return rows.map(mapRow);
    },

    async create(args: Prisma.DialerCampagnaCreateArgs) {
      const d = args.data as Record<string, unknown>;
      const id = randomUUID();
      const now = new Date();
      await query(
        `INSERT INTO "DialerCampagne" (
          "Id","TenantId","Nome","Descrizione","CodiciScarico","PostCallSec","LockTimeoutSec",
          "Stato","PacingRatio","CreatedById","SupervisorId","CreatedAt","UpdatedAt"
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::timestamptz,$13::timestamptz)`,
        [
          id,
          d.tenantId,
          d.nome,
          d.descrizione ?? "",
          d.codiciScarico ?? "[]",
          d.postCallSec ?? 60,
          d.lockTimeoutSec ?? 120,
          d.stato ?? "BOZZA",
          d.pacingRatio ?? null,
          d.createdById,
          d.supervisorId ?? null,
          now,
          now,
        ]
      );
      const rows = await query(`SELECT ${campagnaSelectSql()} FROM "DialerCampagne" c WHERE c."Id" = $1`, [id]);
      return mapRow(rows[0]!);
    },

    async update(args: Prisma.DialerCampagnaUpdateArgs) {
      const id = (args.where as { id: string }).id;
      const d = args.data as Record<string, unknown>;
      const sets: string[] = [`"UpdatedAt" = NOW()`];
      const params: unknown[] = [];
      const add = (col: string, val: unknown, cast?: string) => {
        params.push(val);
        sets.push(`"${col}" = $${params.length}${cast ?? ""}`);
      };
      if (d.stato != null) add("Stato", d.stato);
      if (d.externalId !== undefined) add("ExternalId", d.externalId);
      if (d.activatedAt !== undefined) add("ActivatedAt", d.activatedAt, "::timestamptz");
      if (d.pacingRatio !== undefined) add("PacingRatio", d.pacingRatio);
      params.push(id);
      await query(`UPDATE "DialerCampagne" SET ${sets.join(", ")} WHERE "Id" = $${params.length}`, params);
      const rows = await query(`SELECT ${campagnaSelectSql()} FROM "DialerCampagne" c WHERE c."Id" = $1`, [id]);
      return mapRow(rows[0]!);
    },
  };

  const dialerCampagnaOperatore = {
    async findMany(args: Prisma.DialerCampagnaOperatoreFindManyArgs) {
      return findOperatoriMany(args, query);
    },
    async findFirst(args: Prisma.DialerCampagnaOperatoreFindFirstArgs) {
      const rows = await findOperatoriMany({ ...args, take: 1 }, query);
      return rows[0] ?? null;
    },
    async findUnique(args: Prisma.DialerCampagnaOperatoreFindUniqueArgs) {
      const where = args.where as { id?: string };
      if (!where?.id) return null;
      const rows = await query(`SELECT * FROM "DialerCampagnaOperatori" WHERE "Id" = $1 LIMIT 1`, [where.id]);
      return rows[0] ? mapRow(rows[0]) : null;
    },
    async createMany(args: Prisma.DialerCampagnaOperatoreCreateManyArgs) {
      const data = args.data as Array<Record<string, unknown>>;
      let count = 0;
      for (const row of data) {
        await query(
          `INSERT INTO "DialerCampagnaOperatori" ("Id","CampagnaId","OperatoreId")
           VALUES ($1,$2,$3) ON CONFLICT ("CampagnaId","OperatoreId") DO NOTHING`,
          [randomUUID(), row.campagnaId, row.operatoreId]
        );
        count += 1;
      }
      return { count };
    },
    async update(args: Prisma.DialerCampagnaOperatoreUpdateArgs) {
      const id = (args.where as { id: string }).id;
      await applyOperatoreUpdate(id, args.data as Record<string, unknown>, query);
      const rows = await query(`SELECT * FROM "DialerCampagnaOperatori" WHERE "Id" = $1`, [id]);
      return mapRow(rows[0]!);
    },
    async updateMany(args: Prisma.DialerCampagnaOperatoreUpdateManyArgs) {
      const count = await applyOperatoreUpdateMany(args.where, args.data as Record<string, unknown>, query);
      return { count };
    },
    async count(args: Prisma.DialerCampagnaOperatoreCountArgs) {
      const { sql, params } = operatoreWhereSql(args.where);
      const rows = await query(`SELECT COUNT(*)::int AS c FROM "DialerCampagnaOperatori" WHERE ${sql}`, params);
      return Number(rows[0]?.c ?? 0);
    },
  };

  const dialerCampagnaPratica = {
    async findMany(args: Prisma.DialerCampagnaPraticaFindManyArgs) {
      return findPraticheMany(args, query);
    },
    async createMany(args: Prisma.DialerCampagnaPraticaCreateManyArgs) {
      const data = args.data as Array<Record<string, unknown>>;
      for (const row of data) {
        await query(
          `INSERT INTO "DialerCampagnaPratiche" ("Id","CampagnaId","PraticaId")
           VALUES ($1,$2,$3) ON CONFLICT ("CampagnaId","PraticaId") DO NOTHING`,
          [randomUUID(), row.campagnaId, row.praticaId]
        );
      }
      return { count: data.length };
    },
    async updateMany(args: Prisma.DialerCampagnaPraticaUpdateManyArgs) {
      const count = await applyPraticaUpdateMany(args.where, args.data as Record<string, unknown>, query);
      return { count };
    },
  };

  const dialerChiamataEvento = {
    async findMany(args: Prisma.DialerChiamataEventoFindManyArgs) {
      const { sql, params } = eventoWhereSql(args.where);
      const select = buildEventoSelect(args.select);
      const rows = await query(`SELECT ${select} FROM "DialerChiamataEventi" WHERE ${sql}`, params);
      return rows.map(mapRow);
    },
    async findUnique(args: Prisma.DialerChiamataEventoFindUniqueArgs) {
      const where = args.where as { campagnaId_dedupKey?: { campagnaId: string; dedupKey: string } };
      const key = where.campagnaId_dedupKey;
      if (!key) return null;
      const rows = await query(
        `SELECT * FROM "DialerChiamataEventi" WHERE "CampagnaId" = $1 AND "DedupKey" = $2 LIMIT 1`,
        [key.campagnaId, key.dedupKey]
      );
      return rows[0] ? mapRow(rows[0]) : null;
    },
    async create(args: Prisma.DialerChiamataEventoCreateArgs) {
      const d = args.data as Record<string, unknown>;
      const id = randomUUID();
      const inserted = await query(
        `INSERT INTO "DialerChiamataEventi" (
          "Id","CampagnaId","OperatoreId","PraticaId","Numero","Tipo","Esito","DurataSec",
          "CallId","ExternalCallId","ProviderEventId","DedupKey","Applied","SkipReason","Metadata"
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
        ON CONFLICT ("CampagnaId", "DedupKey") DO NOTHING
        RETURNING *`,
        [
          id,
          d.campagnaId,
          d.operatoreId ?? null,
          d.praticaId ?? null,
          d.numero ?? "",
          d.tipo,
          d.esito ?? null,
          d.durataSec ?? 0,
          d.callId ?? "",
          d.externalCallId ?? null,
          d.providerEventId ?? null,
          d.dedupKey ?? "",
          d.applied ?? true,
          d.skipReason ?? null,
          d.metadata ?? "{}",
        ]
      );
      if (!inserted[0]) {
        const dup = Object.assign(new Error("duplicate dialer event"), { code: "23505" });
        throw dup;
      }
      return mapRow(inserted[0]);
    },
    async count(args: Prisma.DialerChiamataEventoCountArgs) {
      const { sql, params } = eventoWhereSql(args.where);
      const rows = await query(`SELECT COUNT(*)::int AS c FROM "DialerChiamataEventi" WHERE ${sql}`, params);
      return Number(rows[0]?.c ?? 0);
    },
  };

  return {
    dialerCampagna: dialerCampagna as unknown as typeof prisma.dialerCampagna,
    dialerCampagnaOperatore: dialerCampagnaOperatore as unknown as typeof prisma.dialerCampagnaOperatore,
    dialerCampagnaPratica: dialerCampagnaPratica as unknown as typeof prisma.dialerCampagnaPratica,
    dialerChiamataEvento: dialerChiamataEvento as unknown as typeof prisma.dialerChiamataEvento,
    $transaction: (fn) => runTx(fn, ctx),
  };
}

function needsUserScope(where: Prisma.DialerCampagnaWhereInput | undefined): boolean {
  if (!where) return false;
  if (where.AND) return true;
  if (where.OR) return true;
  return false;
}

function buildEventoSelect(select: unknown): string {
  if (!select || typeof select !== "object") return "*";
  const keys = Object.keys(select as Record<string, boolean>).filter((k) => (select as Record<string, boolean>)[k]);
  if (!keys.length) return "*";
  const map: Record<string, string> = {
    tipo: '"Tipo"',
    esito: '"Esito"',
    praticaId: '"PraticaId"',
    operatoreId: '"OperatoreId"',
  };
  return keys.map((k) => map[k] ?? `"${k.charAt(0).toUpperCase()}${k.slice(1)}"`).join(", ");
}

function eventoWhereSql(where: unknown): { sql: string; params: unknown[] } {
  const params: unknown[] = [];
  const clauses: string[] = [];
  const w = (where ?? {}) as Record<string, unknown>;
  if (typeof w.campagnaId === "string") {
    params.push(w.campagnaId);
    clauses.push(`"CampagnaId" = $${params.length}`);
  }
  if (typeof w.callId === "string") {
    params.push(w.callId);
    clauses.push(`"CallId" = $${params.length}`);
  }
  if (w.applied === true) clauses.push(`"Applied" = true`);
  if (w.tipo === "collegata") {
    clauses.push(`"Tipo" = 'collegata'`);
  }
  const opId = w.operatoreId as Record<string, unknown> | string | undefined;
  if (opId && typeof opId === "object" && opId.not === null) {
    clauses.push(`"OperatoreId" IS NOT NULL`);
  }
  const prId = w.praticaId as Record<string, unknown> | undefined;
  if (prId && typeof prId === "object" && prId.not === null) {
    clauses.push(`"PraticaId" IS NOT NULL`);
  }
  if (!clauses.length) clauses.push("TRUE");
  return { sql: clauses.join(" AND "), params };
}

function operatoreWhereSql(where: unknown, alias = ""): { sql: string; params: unknown[] } {
  const params: unknown[] = [];
  const clauses: string[] = [];
  const p = (col: string) => (alias ? `${alias}."${col}"` : `"${col}"`);
  const w = (where ?? {}) as Record<string, unknown>;
  if (typeof w.campagnaId === "string") {
    params.push(w.campagnaId);
    clauses.push(`${p("CampagnaId")} = $${params.length}`);
  }
  if (typeof w.operatoreId === "string") {
    params.push(w.operatoreId);
    clauses.push(eqId(p("OperatoreId"), params.length));
  }
  const campagna = w.campagna as Record<string, unknown> | undefined;
  if (campagna && typeof campagna === "object") {
    const campClauses: string[] = [`c."Id" = ${p("CampagnaId")}`];
    if (typeof campagna.tenantId === "string") {
      params.push(campagna.tenantId);
      campClauses.push(eqId(`c."TenantId"`, params.length));
    }
    const stato = campagna.stato as { in?: string[] } | string | undefined;
    if (stato && typeof stato === "object" && Array.isArray(stato.in)) {
      params.push(stato.in);
      campClauses.push(`c."Stato" = ANY($${params.length}::text[])`);
    } else if (typeof stato === "string") {
      params.push(stato);
      campClauses.push(`c."Stato" = $${params.length}`);
    }
    clauses.push(
      `EXISTS (SELECT 1 FROM "DialerCampagne" c WHERE ${campClauses.join(" AND ")})`
    );
  }
  const acc = w.accettatoAt as Record<string, unknown> | undefined;
  if (acc && typeof acc === "object" && acc.not === null) {
    clauses.push(`${p("AccettatoAt")} IS NOT NULL`);
  }
  if (w.uscitaAt === null) clauses.push(`${p("UscitaAt")} IS NULL`);
  const sess = w.sessioneStato as Record<string, unknown> | string | undefined;
  if (typeof sess === "string") {
    params.push(sess);
    clauses.push(`${p("SessioneStato")} = $${params.length}`);
  } else if (sess && typeof sess === "object" && sess.not) {
    params.push(String(sess.not));
    clauses.push(`${p("SessioneStato")} <> $${params.length}`);
  }
  const ids = w.operatoreId as { in?: string[] } | undefined;
  if (ids && typeof ids === "object" && Array.isArray(ids.in) && ids.in.length) {
    params.push(ids.in);
    clauses.push(eqIdAny(p("OperatoreId"), params.length));
  }
  if (!clauses.length) clauses.push("TRUE");
  return { sql: clauses.join(" AND "), params };
}

async function findOperatoriMany(
  args: Prisma.DialerCampagnaOperatoreFindManyArgs,
  query: QueryFn
): Promise<Record<string, unknown>[]> {
  const { sql, params } = operatoreWhereSql(args.where, "o");
  const include = args.include as {
    operatore?: { select?: { name?: boolean; interno?: boolean } };
    campagna?: boolean | Record<string, unknown>;
  } | undefined;
  const orderBy = args.orderBy as Record<string, unknown> | undefined;
  let orderSql = "";
  if (orderBy?.operatore && typeof orderBy.operatore === "object") {
    const nameDir = (orderBy.operatore as { name?: string }).name;
    if (nameDir === "asc") orderSql = `ORDER BY u."Name" ASC`;
  } else if (orderBy?.invitatoAt === "desc") {
    orderSql = `ORDER BY o."InvitatoAt" DESC`;
  } else if (orderBy?.accettatoAt === "desc") {
    orderSql = `ORDER BY o."AccettatoAt" DESC`;
  }

  const needUser =
    include?.operatore?.select?.name ||
    include?.operatore?.select?.interno ||
    orderSql.includes(`u."Name"`);
  const needCampagna = !!include?.campagna;
  const limit = typeof args.take === "number" ? `LIMIT ${args.take}` : "";

  if (needUser || needCampagna) {
    const campCols = needCampagna
      ? `, c."Id" AS "Camp_Id", c."TenantId" AS "Camp_TenantId", c."Nome" AS "Camp_Nome",
         c."Descrizione" AS "Camp_Descrizione", c."CodiciScarico" AS "Camp_CodiciScarico",
         c."PostCallSec" AS "Camp_PostCallSec", c."LockTimeoutSec" AS "Camp_LockTimeoutSec",
         c."Stato" AS "Camp_Stato", c."PacingRatio" AS "Camp_PacingRatio", c."ExternalId" AS "Camp_ExternalId",
         c."CreatedById" AS "Camp_CreatedById", c."SupervisorId" AS "Camp_SupervisorId",
         c."CreatedAt" AS "Camp_CreatedAt", c."UpdatedAt" AS "Camp_UpdatedAt", c."ActivatedAt" AS "Camp_ActivatedAt"`
      : "";
    const rows = await query(
      `SELECT o.*, u."Name" AS "OperatoreName", u."Interno" AS "OperatoreInterno" ${campCols}
       FROM "DialerCampagnaOperatori" o
       ${needUser || orderSql.includes("u.") ? `INNER JOIN "Users" u ON ${joinId(`u."Id"`, `o."OperatoreId"`)}` : ""}
       ${needCampagna ? `INNER JOIN "DialerCampagne" c ON c."Id" = o."CampagnaId"` : ""}
       WHERE ${sql}
       ${orderSql}
       ${limit}`,
      params
    );
    return rows.map((r) => {
      const m = mapRow(r);
      const out: Record<string, unknown> = { ...m };
      if (include?.operatore?.select?.name || include?.operatore?.select?.interno) {
        out.operatore = {
          ...(include?.operatore?.select?.name
            ? { name: String(r.OperatoreName ?? "") }
            : {}),
          ...(include?.operatore?.select?.interno
            ? { interno: r.OperatoreInterno ?? null }
            : {}),
        };
      }
      if (needCampagna) {
        out.campagna = mapRow({
          Id: r.Camp_Id,
          TenantId: r.Camp_TenantId,
          Nome: r.Camp_Nome,
          Descrizione: r.Camp_Descrizione,
          CodiciScarico: r.Camp_CodiciScarico,
          PostCallSec: r.Camp_PostCallSec,
          LockTimeoutSec: r.Camp_LockTimeoutSec,
          Stato: r.Camp_Stato,
          PacingRatio: r.Camp_PacingRatio,
          ExternalId: r.Camp_ExternalId,
          CreatedById: r.Camp_CreatedById,
          SupervisorId: r.Camp_SupervisorId,
          CreatedAt: r.Camp_CreatedAt,
          UpdatedAt: r.Camp_UpdatedAt,
          ActivatedAt: r.Camp_ActivatedAt,
        });
      }
      return out;
    });
  }

  const rows = await query(
    `SELECT o.* FROM "DialerCampagnaOperatori" o WHERE ${sql} ${orderSql} ${limit}`,
    params
  );
  return rows.map(mapRow);
}

async function findPraticheMany(
  args: Prisma.DialerCampagnaPraticaFindManyArgs,
  query: QueryFn
): Promise<Record<string, unknown>[]> {
  const w = (args.where ?? {}) as Record<string, unknown>;
  const params: unknown[] = [];
  const clauses: string[] = [];
  if (typeof w.campagnaId === "string") {
    params.push(w.campagnaId);
    clauses.push(`dcp."CampagnaId" = $${params.length}`);
  }
  const stato = w.stato as { in?: string[]; not?: string } | string | undefined;
  if (stato && typeof stato === "object" && Array.isArray(stato.in)) {
    params.push(stato.in);
    clauses.push(`dcp."Stato" = ANY($${params.length}::text[])`);
  } else if (stato && typeof stato === "object" && stato.not != null) {
    params.push(String(stato.not));
    clauses.push(`dcp."Stato" <> $${params.length}`);
  } else if (typeof stato === "string") {
    params.push(stato);
    clauses.push(`dcp."Stato" = $${params.length}`);
  }
  if (w.lockedByOperatoreId === null) clauses.push(`dcp."LockedByOperatoreId" IS NULL`);
  const praticaIds = w.praticaId as { in?: string[] } | undefined;
  if (praticaIds?.in?.length) {
    params.push(praticaIds.in);
    clauses.push(eqIdAny(`dcp."PraticaId"`, params.length));
  }
  const ids = w.id as { in?: string[] } | undefined;
  if (ids?.in?.length) {
    params.push(ids.in);
    clauses.push(`dcp."Id" = ANY($${params.length}::text[])`);
  }
  const or = w.OR as Array<Record<string, unknown>> | undefined;
  if (or?.length) {
    const orParts: string[] = [];
    for (const clause of or) {
      if (clause.prossimoTentativoAt === null) orParts.push(`dcp."ProssimoTentativoAt" IS NULL`);
      const lte = clause.prossimoTentativoAt as { lte?: Date } | undefined;
      if (lte?.lte) {
        params.push(lte.lte);
        orParts.push(`dcp."ProssimoTentativoAt" <= $${params.length}::timestamptz`);
      }
    }
    if (orParts.length) clauses.push(`(${orParts.join(" OR ")})`);
  }
  if (!clauses.length) clauses.push("TRUE");

  const include = args.include as { pratica?: { select?: Record<string, unknown> } } | undefined;
  const praticaSelect = include?.pratica?.select;
  const needsPratica = !!praticaSelect;

  if (needsPratica) {
    const rows = await query(
      `SELECT dcp.*, p."CodiceScarico" AS "PraticaCodiceScarico", d."Telefono" AS "DebitoreTelefono", d."TelefonoStato" AS "DebitoreTelefonoStato"
       FROM "DialerCampagnaPratiche" dcp
       INNER JOIN "Pratiche" p ON ${joinId(`p."Id"`, `dcp."PraticaId"`)}
       LEFT JOIN "Debitori" d ON ${joinId(`d."Id"`, `p."DebitoreId"`)}
       WHERE ${clauses.join(" AND ")}`,
      params
    );
    return rows.map((r) => {
      const m = mapRow(r);
      const pratica: Record<string, unknown> = {};
      if (praticaSelect?.id) pratica.id = m.praticaId;
      if (praticaSelect?.codiceScarico) pratica.codiceScarico = r.PraticaCodiceScarico;
      if (praticaSelect?.debitore) {
        pratica.debitore = {
          telefono: r.DebitoreTelefono,
          telefonoStato: r.DebitoreTelefonoStato,
        };
      }
      return { ...m, pratica };
    });
  }

  const rows = await query(`SELECT dcp.* FROM "DialerCampagnaPratiche" dcp WHERE ${clauses.join(" AND ")}`, params);
  return rows.map(mapRow);
}

async function applyOperatoreUpdate(id: string, data: Record<string, unknown>, query: QueryFn) {
  const sets: string[] = [];
  const params: unknown[] = [];
  const set = (col: string, val: unknown, cast = "") => {
    params.push(val);
    sets.push(`"${col}" = $${params.length}${cast}`);
  };
  for (const [key, val] of Object.entries(data)) {
    if (val && typeof val === "object" && "increment" in (val as object)) {
      const col = key.charAt(0).toUpperCase() + key.slice(1);
      sets.push(`"${col}" = "${col}" + ${Number((val as { increment: number }).increment)}`);
      continue;
    }
    const col = key.charAt(0).toUpperCase() + key.slice(1);
    if (val instanceof Date) set(col, val, "::timestamptz");
    else set(col, val);
  }
  if (!sets.length) return;
  params.push(id);
  await query(`UPDATE "DialerCampagnaOperatori" SET ${sets.join(", ")} WHERE "Id" = $${params.length}`, params);
}

async function applyOperatoreUpdateMany(
  where: unknown,
  data: Record<string, unknown>,
  query: QueryFn
): Promise<number> {
  const { sql, params: wParams } = operatoreWhereSql(where);
  const sets: string[] = [];
  const params = [...wParams];
  for (const [key, val] of Object.entries(data)) {
    if (val && typeof val === "object" && "increment" in (val as object)) {
      const col = key.charAt(0).toUpperCase() + key.slice(1);
      sets.push(`"${col}" = "${col}" + ${Number((val as { increment: number }).increment)}`);
      continue;
    }
    const col = key.charAt(0).toUpperCase() + key.slice(1);
    params.push(val instanceof Date ? val : val);
    sets.push(`"${col}" = $${params.length}${val instanceof Date ? "::timestamptz" : ""}`);
  }
  if (!sets.length) return 0;
  const rows = await query(
    `UPDATE "DialerCampagnaOperatori" SET ${sets.join(", ")} WHERE ${sql} RETURNING 1`,
    params
  );
  return rows.length;
}

async function applyPraticaUpdateMany(
  where: unknown,
  data: Record<string, unknown>,
  query: QueryFn
): Promise<number> {
  const w = (where ?? {}) as Record<string, unknown>;
  const params: unknown[] = [];
  const clauses: string[] = [];
  if (typeof w.campagnaId === "string") {
    params.push(w.campagnaId);
    clauses.push(`"CampagnaId" = $${params.length}`);
  }
  if (typeof w.praticaId === "string") {
    params.push(w.praticaId);
    clauses.push(eqId(`"PraticaId"`, params.length));
  }
  const ids = w.id as { in?: string[] } | undefined;
  if (ids?.in?.length) {
    params.push(ids.in);
    clauses.push(`"Id" = ANY($${params.length}::text[])`);
  }
  const lockedCall = w.lockedByCallId as string | undefined;
  if (lockedCall) {
    params.push(lockedCall);
    clauses.push(`"LockedByCallId" = $${params.length}`);
  }
  const statoWhere = w.stato as { in?: string[] } | string | undefined;
  if (statoWhere && typeof statoWhere === "object" && Array.isArray(statoWhere.in)) {
    params.push(statoWhere.in);
    clauses.push(`"Stato" = ANY($${params.length}::text[])`);
  } else if (w.stato === "in_lavorazione") {
    clauses.push(`"Stato" = 'in_lavorazione'`);
  } else if (typeof statoWhere === "string") {
    params.push(statoWhere);
    clauses.push(`"Stato" = $${params.length}`);
  }
  if (w.lockedByOperatoreId === null) {
    clauses.push(`"LockedByOperatoreId" IS NULL`);
  }
  const sets: string[] = [];
  for (const [key, val] of Object.entries(data)) {
    if (val && typeof val === "object" && "increment" in (val as object)) {
      const col = key.charAt(0).toUpperCase() + key.slice(1);
      sets.push(`"${col}" = "${col}" + ${Number((val as { increment: number }).increment)}`);
      continue;
    }
    const col = key.charAt(0).toUpperCase() + key.slice(1);
    if (val === null) {
      sets.push(`"${col}" = NULL`);
    } else {
      params.push(val instanceof Date ? val : val);
      sets.push(`"${col}" = $${params.length}${val instanceof Date ? "::timestamptz" : ""}`);
    }
  }
  if (!clauses.length || !sets.length) return 0;
  const rows = await query(
    `UPDATE "DialerCampagnaPratiche" SET ${sets.join(", ")} WHERE ${clauses.join(" AND ")} RETURNING 1`,
    params
  );
  return rows.length;
}
