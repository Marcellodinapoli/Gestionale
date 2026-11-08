import "server-only";
import { neonQuery } from "@/lib/neon/pool";
import type {
  ImpegnoAgendaDto,
  ImpegnoAgendaFilter,
  ImpegniAgendaRepository,
} from "@/lib/data/contracts/impegniAgenda";

function toIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(String(value ?? ""));
  return Number.isNaN(parsed.getTime()) ? String(value ?? "") : parsed.toISOString();
}

function mapRow(row: Record<string, unknown>): ImpegnoAgendaDto {
  return {
    id: String(row.Id),
    userId: String(row.UserId),
    titolo: String(row.Titolo),
    nota: row.Nota != null ? String(row.Nota) : null,
    memoAt: toIso(row.MemoAt),
    completato: Boolean(row.Completato),
    completatoAt: row.CompletatoAt != null ? toIso(row.CompletatoAt) : null,
    createdAt: toIso(row.CreatedAt),
    userName: row.UserName != null ? String(row.UserName) : undefined,
  };
}

function buildWhere(
  tenantId: string,
  filter?: ImpegnoAgendaFilter
): { sql: string; params: unknown[] } {
  const where: string[] = [`i."TenantId" = $1::uuid`];
  const params: unknown[] = [tenantId];
  let i = 2;

  if (filter?.userId) {
    where.push(`i."UserId" = $${i++}::uuid`);
    params.push(filter.userId);
  }
  if (filter?.id) {
    where.push(`i."Id" = $${i++}::uuid`);
    params.push(filter.id);
  }
  if (filter?.completato === false) where.push(`i."Completato" = false`);
  if (filter?.completato === true) where.push(`i."Completato" = true`);
  if (filter?.memoAtGte) {
    where.push(`i."MemoAt" >= $${i++}::timestamptz`);
    params.push(filter.memoAtGte);
  }
  if (filter?.memoAtLte) {
    where.push(`i."MemoAt" <= $${i++}::timestamptz`);
    params.push(filter.memoAtLte);
  }

  return { sql: where.join(" AND "), params };
}

export class NeonImpegniAgendaRepository implements ImpegniAgendaRepository {
  constructor(private _tenantSlug: string) {}

  async list(
    _tenantSlug: string,
    tenantId: string,
    filter?: ImpegnoAgendaFilter,
    take = 200
  ): Promise<ImpegnoAgendaDto[]> {
    const { sql, params } = buildWhere(tenantId, filter);
    params.push(take);
    const rows = await neonQuery<Record<string, unknown>>(
      `SELECT i."Id", i."UserId", i."Titolo", i."Nota", i."MemoAt", i."Completato",
              i."CompletatoAt", i."CreatedAt", u."Name" AS "UserName"
       FROM "ImpegniAgenda" i
       LEFT JOIN "Users" u ON u."Id" = i."UserId"
       WHERE ${sql}
       ORDER BY i."MemoAt" ASC
       LIMIT $${params.length}`,
      params
    );
    return rows.map(mapRow);
  }

  async getById(
    _tenantSlug: string,
    tenantId: string,
    id: string
  ): Promise<ImpegnoAgendaDto | null> {
    const rows = await neonQuery<Record<string, unknown>>(
      `SELECT i."Id", i."UserId", i."Titolo", i."Nota", i."MemoAt", i."Completato",
              i."CompletatoAt", i."CreatedAt", u."Name" AS "UserName"
       FROM "ImpegniAgenda" i
       LEFT JOIN "Users" u ON u."Id" = i."UserId"
       WHERE i."Id" = $1::uuid AND i."TenantId" = $2::uuid
       LIMIT 1`,
      [id, tenantId]
    );
    return rows[0] ? mapRow(rows[0]) : null;
  }

  async create(
    _tenantSlug: string,
    tenantId: string,
    data: { userId: string; titolo: string; nota?: string | null; memoAt: string | Date }
  ): Promise<ImpegnoAgendaDto> {
    const id = crypto.randomUUID();
    await neonQuery(
      `INSERT INTO "ImpegniAgenda"
         ("Id","TenantId","UserId","Titolo","Nota","MemoAt","Completato","CompletatoAt","CreatedAt")
       VALUES ($1::uuid,$2::uuid,$3::uuid,$4,$5,$6::timestamptz,false,NULL,NOW())`,
      [id, tenantId, data.userId, data.titolo, data.nota ?? null, new Date(data.memoAt).toISOString()]
    );
    const row = await this.getById(_tenantSlug, tenantId, id);
    if (!row) throw new Error("Creazione impegno fallita");
    return row;
  }

  async complete(
    _tenantSlug: string,
    tenantId: string,
    id: string,
    userId: string
  ): Promise<void> {
    await neonQuery(
      `UPDATE "ImpegniAgenda"
       SET "Completato" = true, "CompletatoAt" = NOW()
       WHERE "Id" = $1::uuid AND "TenantId" = $2::uuid AND "UserId" = $3::uuid AND "Completato" = false`,
      [id, tenantId, userId]
    );
  }

  async update(
    _tenantSlug: string,
    tenantId: string,
    id: string,
    userId: string,
    data: { titolo?: string; nota?: string | null; memoAt?: string | Date }
  ): Promise<ImpegnoAgendaDto | null> {
    const existing = await neonQuery<{ UserId: string }>(
      `SELECT "UserId" FROM "ImpegniAgenda"
       WHERE "Id" = $1::uuid AND "TenantId" = $2::uuid
       LIMIT 1`,
      [id, tenantId]
    );
    if (!existing[0] || String(existing[0].UserId) !== userId) return null;

    const sets: string[] = [];
    const params: unknown[] = [];
    let i = 1;

    if (data.titolo != null) {
      sets.push(`"Titolo" = $${i++}`);
      params.push(data.titolo);
    }
    if (data.nota !== undefined) {
      sets.push(`"Nota" = $${i++}`);
      params.push(data.nota);
    }
    if (data.memoAt != null) {
      sets.push(`"MemoAt" = $${i++}::timestamptz`);
      params.push(new Date(data.memoAt).toISOString());
    }

    if (sets.length === 0) return this.getById(_tenantSlug, tenantId, id);

    params.push(id, tenantId);
    await neonQuery(
      `UPDATE "ImpegniAgenda"
       SET ${sets.join(", ")}
       WHERE "Id" = $${i++}::uuid AND "TenantId" = $${i++}::uuid`,
      params
    );

    return this.getById(_tenantSlug, tenantId, id);
  }

  async delete(
    _tenantSlug: string,
    tenantId: string,
    id: string,
    userId: string
  ): Promise<void> {
    await neonQuery(
      `DELETE FROM "ImpegniAgenda"
       WHERE "Id" = $1::uuid AND "TenantId" = $2::uuid AND "UserId" = $3::uuid`,
      [id, tenantId, userId]
    );
  }
}

export function createNeonImpegniAgendaRepository(tenantSlug: string) {
  return new NeonImpegniAgendaRepository(tenantSlug);
}
