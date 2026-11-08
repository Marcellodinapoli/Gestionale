import "server-only";
import { neonQuery } from "@/lib/neon/pool";
import { mapSqlRow } from "@/lib/data/mapSqlRow";
import type {
  ConfigurazioneDto,
  ConfigurazioneFilter,
  ConfigurazioneRepository,
  ConfigurazioneUpsertInput,
} from "@/lib/data/contracts/configurazione";

function mapRow(row: Record<string, unknown>): ConfigurazioneDto {
  const mapped = mapSqlRow(row);
  if (typeof mapped.updatedAt === "string") {
    mapped.updatedAt = new Date(mapped.updatedAt);
  }
  return mapped as ConfigurazioneDto;
}

function buildWhereParts(
  tenantId: string,
  filter?: ConfigurazioneFilter
): { sql: string; params: unknown[] } {
  const where: string[] = [`"TenantId" = $1::uuid`];
  const params: unknown[] = [tenantId];
  let i = 2;

  if (filter?.chiave) {
    where.push(`"Chiave" = $${i++}`);
    params.push(filter.chiave);
  }
  if (filter?.chiaviIn?.length) {
    where.push(`"Chiave" = ANY($${i++}::text[])`);
    params.push(filter.chiaviIn);
  }
  if (filter?.categoria) {
    where.push(`"Categoria" = $${i++}`);
    params.push(filter.categoria);
  }
  if (filter?.chiaveStartsWith) {
    where.push(`"Chiave" LIKE $${i++}`);
    params.push(`${filter.chiaveStartsWith}%`);
  }
  if (filter?.chiaviOrStartsWith?.length) {
    const orClauses: string[] = [];
    for (const clause of filter.chiaviOrStartsWith) {
      if (clause.startsWith) {
        orClauses.push(`"Chiave" LIKE $${i++}`);
        params.push(`${clause.startsWith}%`);
      } else if (clause.in?.length) {
        orClauses.push(`"Chiave" = ANY($${i++}::text[])`);
        params.push(clause.in);
      }
    }
    if (orClauses.length) where.push(`(${orClauses.join(" OR ")})`);
  }

  return { sql: where.join(" AND "), params };
}

export class NeonConfigurazioneRepository implements ConfigurazioneRepository {
  constructor(private _tenantSlug: string) {}

  async list(
    _tenantSlug: string,
    tenantId: string,
    filter?: ConfigurazioneFilter
  ): Promise<ConfigurazioneDto[]> {
    const { sql, params } = buildWhereParts(tenantId, filter);
    const rows = await neonQuery<Record<string, unknown>>(
      `SELECT "Id", "TenantId", "Chiave", "Valore", "Categoria", "UpdatedAt"
       FROM "ConfigurazioneSistema"
       WHERE ${sql}`,
      params
    );
    return rows.map(mapRow);
  }

  async findByChiave(
    _tenantSlug: string,
    tenantId: string,
    chiave: string,
    _select?: Record<string, unknown>
  ): Promise<ConfigurazioneDto | null> {
    const rows = await neonQuery<Record<string, unknown>>(
      `SELECT "Id", "TenantId", "Chiave", "Valore", "Categoria", "UpdatedAt"
       FROM "ConfigurazioneSistema"
       WHERE "TenantId" = $1::uuid AND "Chiave" = $2
       LIMIT 1`,
      [tenantId, chiave]
    );
    return rows[0] ? mapRow(rows[0]) : null;
  }

  async upsert(
    _tenantSlug: string,
    data: ConfigurazioneUpsertInput
  ): Promise<ConfigurazioneDto> {
    const existing = await this.findByChiave(
      _tenantSlug,
      data.tenantId,
      data.chiave
    );

    if (existing) {
      await neonQuery(
        `UPDATE "ConfigurazioneSistema"
         SET "Valore" = $1, "Categoria" = $2, "UpdatedAt" = NOW()
         WHERE "TenantId" = $3::uuid AND "Chiave" = $4`,
        [data.valore, data.categoria, data.tenantId, data.chiave]
      );
      return {
        ...existing,
        valore: data.valore,
        categoria: data.categoria,
        updatedAt: new Date(),
      };
    }

    const id = crypto.randomUUID();
    await neonQuery(
      `INSERT INTO "ConfigurazioneSistema"
         ("Id","TenantId","Chiave","Valore","Categoria","UpdatedAt")
       VALUES ($1::uuid,$2::uuid,$3,$4,$5,NOW())`,
      [id, data.tenantId, data.chiave, data.valore, data.categoria]
    );

    return {
      id,
      tenantId: data.tenantId,
      chiave: data.chiave,
      valore: data.valore,
      categoria: data.categoria,
      updatedAt: new Date(),
    };
  }

  async deleteMany(
    _tenantSlug: string,
    tenantId: string,
    filter: ConfigurazioneFilter
  ): Promise<{ count: number }> {
    const { sql, params } = buildWhereParts(tenantId, filter);
    const rows = await neonQuery<{ count: number }>(
      `WITH deleted AS (
         DELETE FROM "ConfigurazioneSistema"
         WHERE ${sql}
         RETURNING 1
       )
       SELECT COUNT(*)::int AS count FROM deleted`,
      params
    );
    return { count: rows[0]?.count ?? 0 };
  }
}

export function createNeonConfigurazioneRepository(tenantSlug: string) {
  return new NeonConfigurazioneRepository(tenantSlug);
}
