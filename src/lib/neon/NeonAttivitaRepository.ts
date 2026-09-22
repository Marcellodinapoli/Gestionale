import "server-only";
import { getNeonPool, neonQuery } from "@/lib/neon/pool";
import { mapSqlRow } from "@/lib/data/mapSqlRow";
import type {
  AttivitaCreateInput,
  AttivitaFilter,
  AttivitaListRequest,
  AttivitaRepository,
  AttivitaUpdateInput,
  AttivitaDto,
} from "@/lib/data/contracts/attivita";

function mapAttivita(row: Record<string, unknown>): AttivitaDto {
  const mapped = mapSqlRow(row);
  for (const k of ["createdAt", "scheduledAt"] as const) {
    if (typeof mapped[k] === "string") mapped[k] = new Date(String(mapped[k]));
  }
  if (row.User_Id != null || row.User_Name != null) {
    mapped.user = {
      id: row.User_Id ?? null,
      name: row.User_Name ?? "Operatore",
    };
  } else if (row.user && typeof row.user === "object") {
    mapped.user = mapSqlRow(row.user as Record<string, unknown>);
  }
  return mapped;
}

function filterSql(
  filter: AttivitaFilter | undefined,
  startIdx: number
): { sql: string; params: unknown[]; next: number; join: string } {
  if (filter?.none) {
    return { sql: " AND 1 = 0", params: [], next: startIdx, join: "" };
  }
  const parts: string[] = [];
  const params: unknown[] = [];
  let i = startIdx;
  let join = "";
  if (filter?.praticaId) {
    parts.push(`a."PraticaId" = $${i++}::uuid`);
    params.push(filter.praticaId);
  }
  if (filter?.praticaIdsIn?.length) {
    parts.push(`a."PraticaId" = ANY($${i++}::uuid[])`);
    params.push(filter.praticaIdsIn);
  }
  if (filter?.userId) {
    parts.push(`a."UserId" = $${i++}::uuid`);
    params.push(filter.userId);
  }
  if (filter?.tipo) {
    parts.push(`a."Tipo" = $${i++}`);
    params.push(filter.tipo);
  }
  if (filter?.fissata === true) parts.push(`a."Fissata" = true`);
  else if (filter?.fissata === false) parts.push(`a."Fissata" = false`);
  if (filter?.createdAtGte) {
    parts.push(`a."CreatedAt" >= $${i++}::timestamptz`);
    params.push(filter.createdAtGte);
  }
  if (filter?.createdAtLte) {
    parts.push(`a."CreatedAt" <= $${i++}::timestamptz`);
    params.push(filter.createdAtLte);
  }
  if (filter?.userRoleIn?.length) {
    join = ` INNER JOIN "Users" u ON u."Id" = a."UserId" `;
    parts.push(`u."Role" = ANY($${i++}::text[])`);
    params.push(filter.userRoleIn);
  }
  return {
    sql: parts.length ? ` AND ${parts.join(" AND ")}` : "",
    params,
    next: i,
    join,
  };
}

export class NeonAttivitaRepository implements AttivitaRepository {
  constructor(private _tenantSlug: string) {}

  async list(req: AttivitaListRequest): Promise<{ items: AttivitaDto[]; total: number }> {
    const filt = filterSql(req.filter, 2);
    let join = filt.join;
    if (req.includeUser && !join.includes('"Users"')) {
      join += ` LEFT JOIN "Users" u ON u."Id" = a."UserId" `;
    }
    const where = `a."TenantId" = $1::uuid${filt.sql}`;
    const params = [req.tenantId, ...filt.params];
    const countRows = await neonQuery(
      `SELECT COUNT(*)::int AS c FROM "Attivita" a ${join} WHERE ${where}`,
      params
    );
    const total = Number((countRows[0] as { c: number })?.c ?? 0);
    const order = req.orderBy?.createdAt === "asc" ? "ASC" : "DESC";
    const take = req.take ?? 5000;
    const skip = req.skip ?? 0;
    let select = `a.*`;
    if (req.includeUser) {
      select += `, u."Id" AS "User_Id", u."Name" AS "User_Name"`;
    }
    const rows = await neonQuery(
      `SELECT ${select}
       FROM "Attivita" a
       ${join}
       WHERE ${where}
       ORDER BY a."CreatedAt" ${order}
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, take, skip]
    );
    return { items: rows.map((r) => mapAttivita(r as Record<string, unknown>)), total };
  }

  async count(_tenantSlug: string, tenantId: string, filter?: AttivitaFilter) {
    const filt = filterSql(filter, 2);
    const rows = await neonQuery(
      `SELECT COUNT(*)::int AS c FROM "Attivita" a ${filt.join}
       WHERE a."TenantId" = $1::uuid${filt.sql}`,
      [tenantId, ...filt.params]
    );
    return Number((rows[0] as { c: number })?.c ?? 0);
  }

  async groupByUserId(_tenantSlug: string, tenantId: string, filter?: AttivitaFilter) {
    const filt = filterSql(filter, 2);
    const rows = await neonQuery(
      `SELECT a."UserId" AS "userId", COUNT(*)::int AS cnt
       FROM "Attivita" a ${filt.join}
       WHERE a."TenantId" = $1::uuid${filt.sql}
       GROUP BY a."UserId"`,
      [tenantId, ...filt.params]
    );
    return rows.map((r) => ({
      userId: String((r as { userId: string }).userId),
      _count: Number((r as { cnt: number }).cnt),
    }));
  }

  async getById(_tenantSlug: string, tenantId: string, id: string) {
    const rows = await neonQuery(
      `SELECT * FROM "Attivita"
       WHERE "Id" = $1::uuid AND "TenantId" = $2::uuid
       LIMIT 1`,
      [id, tenantId]
    );
    return rows[0] ? mapAttivita(rows[0] as Record<string, unknown>) : null;
  }

  async create(
    _tenantSlug: string,
    tenantId: string,
    data: AttivitaCreateInput
  ): Promise<AttivitaDto> {
    const id = crypto.randomUUID();
    const scheduledAt =
      data.scheduledAt == null
        ? null
        : data.scheduledAt instanceof Date
          ? data.scheduledAt.toISOString()
          : String(data.scheduledAt);
    await neonQuery(
      `INSERT INTO "Attivita" (
         "Id","TenantId","PraticaId","UserId","Tipo","Esito","Nota",
         "ScheduledAt","Fissata","Importante","Bloccata","CreatedAt"
       ) VALUES (
         $1::uuid,$2::uuid,$3::uuid,$4::uuid,$5,$6,$7,
         $8::timestamptz,$9,$10,$11,NOW()
       )`,
      [
        id,
        tenantId,
        data.praticaId,
        data.userId,
        data.tipo,
        data.esito ?? null,
        data.nota ?? null,
        scheduledAt,
        Boolean(data.fissata),
        Boolean(data.importante),
        Boolean(data.bloccata),
      ]
    );
    const row = await this.getById(_tenantSlug, tenantId, id);
    if (!row) throw new Error("Creazione attività fallita");
    return row;
  }

  async update(
    tenantSlug: string,
    tenantId: string,
    id: string,
    data: AttivitaUpdateInput
  ): Promise<AttivitaDto> {
    const map: Record<string, string> = {
      nota: "Nota",
      fissata: "Fissata",
      importante: "Importante",
      bloccata: "Bloccata",
      esito: "Esito",
      tipo: "Tipo",
    };
    const sets: string[] = [];
    const params: unknown[] = [];
    let i = 1;
    for (const [key, col] of Object.entries(map)) {
      const val = (data as Record<string, unknown>)[key];
      if (val === undefined) continue;
      if (val == null) sets.push(`"${col}" = NULL`);
      else {
        sets.push(`"${col}" = $${i++}`);
        params.push(val);
      }
    }
    if (sets.length) {
      params.push(id, tenantId);
      await neonQuery(
        `UPDATE "Attivita" SET ${sets.join(", ")}
         WHERE "Id" = $${i++}::uuid AND "TenantId" = $${i}::uuid`,
        params
      );
    }
    const row = await this.getById(tenantSlug, tenantId, id);
    if (!row) throw new Error("Attività non trovata");
    return row;
  }

  async updateMany(
    _tenantSlug: string,
    tenantId: string,
    filter: AttivitaFilter,
    data: AttivitaUpdateInput
  ) {
    const filt = filterSql(filter, 2);
    const sets: string[] = [];
    const params: unknown[] = [tenantId, ...filt.params];
    let i = filt.next;
    if (data.fissata !== undefined) {
      sets.push(`a."Fissata" = $${i++}`);
      params.push(Boolean(data.fissata));
    }
    if (!sets.length) return { count: 0 };
    if (!filt.join) {
      const rows = await neonQuery(
        `UPDATE "Attivita" a SET ${sets.join(", ")}
         WHERE a."TenantId" = $1::uuid${filt.sql}
         RETURNING a."Id"`,
        params
      );
      return { count: rows.length };
    }
    const rows = await neonQuery(
      `UPDATE "Attivita" a SET ${sets.join(", ")}
       FROM "Users" u
       WHERE a."TenantId" = $1::uuid AND u."Id" = a."UserId"${filt.sql}
       RETURNING a."Id"`,
      params
    );
    return { count: rows.length };
  }

  async deleteMany(_tenantSlug: string, tenantId: string, filter: AttivitaFilter) {
    const filt = filterSql(filter, 2);
    if (!filt.join) {
      const rows = await neonQuery(
        `DELETE FROM "Attivita" a
         WHERE a."TenantId" = $1::uuid${filt.sql}
         RETURNING a."Id"`,
        [tenantId, ...filt.params]
      );
      return { count: rows.length };
    }
    const rows = await neonQuery(
      `DELETE FROM "Attivita" a
       USING "Users" u
       WHERE a."TenantId" = $1::uuid AND u."Id" = a."UserId"${filt.sql}
       RETURNING a."Id"`,
      [tenantId, ...filt.params]
    );
    return { count: rows.length };
  }

  async toggleFissa(
    _tenantSlug: string,
    tenantId: string,
    attivitaId: string,
    praticaId: string,
    fissata: boolean
  ) {
    const client = await getNeonPool().connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `UPDATE "Attivita" SET "Fissata" = false
         WHERE "TenantId" = $1::uuid AND "PraticaId" = $2::uuid AND "Fissata" = true`,
        [tenantId, praticaId]
      );
      if (fissata) {
        await client.query(
          `UPDATE "Attivita" SET "Fissata" = true
           WHERE "TenantId" = $1::uuid AND "Id" = $2::uuid`,
          [tenantId, attivitaId]
        );
      }
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }
}

export function createNeonAttivitaRepository(tenantSlug: string) {
  return new NeonAttivitaRepository(tenantSlug);
}
