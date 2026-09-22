import "server-only";
import { neonQuery } from "@/lib/neon/pool";
import { mapSqlRow } from "@/lib/data/mapSqlRow";
import type {
  SedeCreateInput,
  SedeFilter,
  SedeUpdateInput,
  SediRepository,
  SedeDto,
} from "@/lib/data/contracts/sedi";

function mapSede(row: Record<string, unknown>): SedeDto {
  const mapped = mapSqlRow(row);
  if (typeof mapped.createdAt === "string") {
    mapped.createdAt = new Date(mapped.createdAt);
  }
  if (row.PostazioneCount != null || row.UserCount != null) {
    mapped._count = {
      postazioni: Number(row.PostazioneCount ?? 0),
      users: Number(row.UserCount ?? 0),
    };
  }
  return mapped as SedeDto;
}

function filterParts(
  filter: SedeFilter | undefined,
  startIdx: number
): { sql: string; params: unknown[]; next: number } {
  const parts: string[] = [];
  const params: unknown[] = [];
  let i = startIdx;
  if (filter?.id) {
    parts.push(`s."Id" = $${i++}::uuid`);
    params.push(filter.id);
  }
  if (filter?.idsIn?.length) {
    parts.push(`s."Id" = ANY($${i++}::uuid[])`);
    params.push(filter.idsIn);
  }
  if (filter?.nome) {
    parts.push(`s."Nome" = $${i++}`);
    params.push(filter.nome);
  }
  if (typeof filter?.active === "boolean") {
    parts.push(`s."Active" = $${i++}`);
    params.push(filter.active);
  }
  if (filter?.excludeId) {
    parts.push(`s."Id" <> $${i++}::uuid`);
    params.push(filter.excludeId);
  }
  return {
    sql: parts.length ? ` AND ${parts.join(" AND ")}` : "",
    params,
    next: i,
  };
}

export class NeonSediRepository implements SediRepository {
  constructor(private _tenantSlug: string) {}

  async list(
    _tenantSlug: string,
    tenantId: string,
    filter?: SedeFilter & {
      orderBy?: "nome" | "createdAt";
      orderDir?: "asc" | "desc";
      take?: number;
      includeCounts?: boolean;
    }
  ): Promise<SedeDto[]> {
    const filt = filterParts(filter, 2);
    const order =
      filter?.orderBy === "createdAt" ? `s."CreatedAt"` : `s."Nome"`;
    const dir = filter?.orderDir === "desc" ? "DESC" : "ASC";
    const take = filter?.take ?? 500;
    const countCols = filter?.includeCounts
      ? `, (SELECT COUNT(*)::int FROM "Postazioni" p WHERE p."SedeId" = s."Id" AND p."TenantId" = s."TenantId") AS "PostazioneCount"
         , (SELECT COUNT(*)::int FROM "Users" u WHERE u."SedeId" = s."Id" AND u."TenantId" = s."TenantId") AS "UserCount"`
      : "";
    const rows = await neonQuery(
      `SELECT s.*${countCols}
       FROM "Sedi" s
       WHERE s."TenantId" = $1::uuid${filt.sql}
       ORDER BY ${order} ${dir}
       LIMIT $${filt.next}`,
      [tenantId, ...filt.params, take]
    );
    return rows.map((r) => mapSede(r as Record<string, unknown>));
  }

  async count(_tenantSlug: string, tenantId: string, filter?: SedeFilter) {
    const filt = filterParts(filter, 2);
    const rows = await neonQuery(
      `SELECT COUNT(*)::int AS c FROM "Sedi" s WHERE s."TenantId" = $1::uuid${filt.sql}`,
      [tenantId, ...filt.params]
    );
    return Number((rows[0] as { c: number })?.c ?? 0);
  }

  async getById(_tenantSlug: string, tenantId: string, id: string) {
    const rows = await neonQuery(
      `SELECT * FROM "Sedi"
       WHERE "Id" = $1::uuid AND "TenantId" = $2::uuid
       LIMIT 1`,
      [id, tenantId]
    );
    return rows[0] ? mapSede(rows[0] as Record<string, unknown>) : null;
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

  async create(_tenantSlug: string, data: SedeCreateInput): Promise<SedeDto> {
    const id = crypto.randomUUID();
    await neonQuery(
      `INSERT INTO "Sedi" (
         "Id","TenantId","Nome","Indirizzo","Citta","Cap","Provincia",
         "Telefono","Email","Note","Active","CreatedAt"
       ) VALUES (
         $1::uuid,$2::uuid,$3,$4,$5,$6,$7,
         $8,$9,$10,$11,NOW()
       )`,
      [
        id,
        data.tenantId,
        data.nome,
        data.indirizzo ?? null,
        data.citta ?? null,
        data.cap ?? null,
        data.provincia ?? null,
        data.telefono ?? null,
        data.email ?? null,
        data.note ?? null,
        data.active !== false,
      ]
    );
    const row = await this.getById(_tenantSlug, data.tenantId, id);
    if (!row) throw new Error("Creazione sede fallita");
    return row;
  }

  async update(
    tenantSlug: string,
    tenantId: string,
    id: string,
    data: SedeUpdateInput
  ): Promise<SedeDto> {
    const map: Record<string, string> = {
      nome: "Nome",
      indirizzo: "Indirizzo",
      citta: "Citta",
      cap: "Cap",
      provincia: "Provincia",
      telefono: "Telefono",
      email: "Email",
      note: "Note",
      active: "Active",
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
        `UPDATE "Sedi" SET ${sets.join(", ")}
         WHERE "Id" = $${i++}::uuid AND "TenantId" = $${i}::uuid`,
        params
      );
    }
    const row = await this.getById(tenantSlug, tenantId, id);
    if (!row) throw new Error("Sede non trovata");
    return row;
  }
}

export function createNeonSediRepository(tenantSlug: string) {
  return new NeonSediRepository(tenantSlug);
}
