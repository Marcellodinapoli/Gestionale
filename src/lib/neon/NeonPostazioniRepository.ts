import "server-only";
import { neonQuery } from "@/lib/neon/pool";
import { mapSqlRow } from "@/lib/data/mapSqlRow";
import type {
  PostazioneCreateInput,
  PostazioneFilter,
  PostazioneListOptions,
  PostazioneUpdateInput,
  PostazioniRepository,
  PostazioneDto,
} from "@/lib/data/contracts/postazioni";

function mapPostazione(row: Record<string, unknown>): PostazioneDto {
  const mapped = mapSqlRow(row);
  if (row.SedeNome != null) {
    mapped.sedeRef = { nome: row.SedeNome };
  }
  if (Array.isArray(row.occupanti)) {
    mapped.occupanti = row.occupanti;
  }
  return mapped;
}

export class NeonPostazioniRepository implements PostazioniRepository {
  constructor(private _tenantSlug: string) {}

  async list(
    _tenantSlug: string,
    tenantId: string,
    filter?: PostazioneListOptions
  ): Promise<PostazioneDto[]> {
    const parts = [`p."TenantId" = $1::uuid`];
    const params: unknown[] = [tenantId];
    let i = 2;
    if (typeof filter?.active === "boolean") {
      parts.push(`p."Active" = $${i++}`);
      params.push(filter.active);
    }
    if (filter?.id) {
      parts.push(`p."Id" = $${i++}::uuid`);
      params.push(filter.id);
    }
    if (filter?.idsIn?.length) {
      parts.push(`p."Id" = ANY($${i++}::uuid[])`);
      params.push(filter.idsIn);
    }
    if (filter?.nome) {
      parts.push(`p."Nome" = $${i++}`);
      params.push(filter.nome);
    }
    if (filter?.interno) {
      parts.push(`(p."Interno" = $${i} OR p."Nome" = $${i})`);
      params.push(filter.interno);
      i += 1;
    }
    const order =
      filter?.orderBy === "createdAt"
        ? `p."CreatedAt"`
        : filter?.orderBy === "sedeNome"
          ? `s."Nome" NULLS LAST, p."Nome"`
          : `p."Nome"`;
    const dir = filter?.orderDir === "desc" ? "DESC" : "ASC";
    const take = filter?.take ?? 500;
    const rows = await neonQuery(
      `SELECT p.*, s."Nome" AS "SedeNome"
       FROM "Postazioni" p
       LEFT JOIN "Sedi" s ON s."Id" = p."SedeId"
       WHERE ${parts.join(" AND ")}
       ORDER BY ${order} ${dir}
       LIMIT $${i}`,
      [...params, take]
    );
    const items = rows.map((r) => mapPostazione(r as Record<string, unknown>));
    if (filter?.includeOccupants) {
      for (const item of items) {
        const occParams: unknown[] = [tenantId, item.id];
        let occSql = `SELECT "Id", "Name" FROM "Users"
          WHERE "TenantId" = $1::uuid AND "PostazioneId" = $2::uuid AND "Active" = true`;
        if (filter.excludeOccupantUserId) {
          occSql += ` AND "Id" <> $3::uuid`;
          occParams.push(filter.excludeOccupantUserId);
        }
        const occ = await neonQuery(occSql, occParams);
        item.occupanti = occ.map((o) => {
          const m = mapSqlRow(o as Record<string, unknown>);
          return { id: m.id, name: m.name };
        });
      }
    }
    return items;
  }

  async count(_tenantSlug: string, tenantId: string, filter?: PostazioneFilter) {
    const parts = [`"TenantId" = $1::uuid`];
    const params: unknown[] = [tenantId];
    let i = 2;
    if (typeof filter?.active === "boolean") {
      parts.push(`"Active" = $${i++}`);
      params.push(filter.active);
    }
    const rows = await neonQuery(
      `SELECT COUNT(*)::int AS c FROM "Postazioni" WHERE ${parts.join(" AND ")}`,
      params
    );
    return Number((rows[0] as { c: number })?.c ?? 0);
  }

  async getById(_tenantSlug: string, tenantId: string, id: string) {
    const rows = await neonQuery(
      `SELECT p.*, s."Nome" AS "SedeNome"
       FROM "Postazioni" p
       LEFT JOIN "Sedi" s ON s."Id" = p."SedeId"
       WHERE p."Id" = $1::uuid AND p."TenantId" = $2::uuid
       LIMIT 1`,
      [id, tenantId]
    );
    return rows[0] ? mapPostazione(rows[0] as Record<string, unknown>) : null;
  }

  async findByNome(
    tenantSlug: string,
    tenantId: string,
    nome: string,
    excludeId?: string
  ) {
    const items = await this.list(tenantSlug, tenantId, {
      nome,
      excludeId,
      take: 1,
    });
    return items[0] ?? null;
  }

  async create(_tenantSlug: string, data: PostazioneCreateInput): Promise<PostazioneDto> {
    const id = crypto.randomUUID();
    await neonQuery(
      `INSERT INTO "Postazioni" ("Id","TenantId","SedeId","Nome","Interno","Email","NumeroFisso","Note","Active","CreatedAt")
       VALUES ($1::uuid,$2::uuid,$3::uuid,$4,$5,$6,$7,$8,true,NOW())`,
      [
        id,
        data.tenantId,
        data.sedeId ?? null,
        data.nome,
        data.interno ?? null,
        data.email ?? null,
        data.numeroFisso ?? null,
        data.note ?? null,
      ]
    );
    const row = await this.getById(_tenantSlug, data.tenantId, id);
    if (!row) throw new Error("Creazione postazione fallita");
    return row;
  }

  async update(
    tenantSlug: string,
    tenantId: string,
    id: string,
    data: PostazioneUpdateInput
  ): Promise<PostazioneDto> {
    const sets: string[] = [];
    const params: unknown[] = [];
    let i = 1;
    if (data.nome !== undefined) {
      sets.push(`"Nome" = $${i++}`);
      params.push(data.nome);
    }
    if (data.interno !== undefined) {
      sets.push(`"Interno" = $${i++}`);
      params.push(data.interno);
    }
    if (data.active !== undefined) {
      sets.push(`"Active" = $${i++}`);
      params.push(data.active);
    }
    if (data.sedeId !== undefined) {
      if (data.sedeId == null) sets.push(`"SedeId" = NULL`);
      else {
        sets.push(`"SedeId" = $${i++}::uuid`);
        params.push(data.sedeId);
      }
    }
    if (sets.length) {
      params.push(id, tenantId);
      await neonQuery(
        `UPDATE "Postazioni" SET ${sets.join(", ")}
         WHERE "Id" = $${i++}::uuid AND "TenantId" = $${i}::uuid`,
        params
      );
    }
    const row = await this.getById(tenantSlug, tenantId, id);
    if (!row) throw new Error("Postazione non trovata");
    return row;
  }

  async delete(_tenantSlug: string, tenantId: string, id: string) {
    await neonQuery(
      `DELETE FROM "Postazioni" WHERE "Id" = $1::uuid AND "TenantId" = $2::uuid`,
      [id, tenantId]
    );
  }
}

export function createNeonPostazioniRepository(tenantSlug: string) {
  return new NeonPostazioniRepository(tenantSlug);
}
