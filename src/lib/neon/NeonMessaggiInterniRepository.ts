import "server-only";
import { neonQuery } from "@/lib/neon/pool";
import type {
  MessaggiInterniRepository,
  MessaggioInternoDto,
  MessaggioInternoFilter,
} from "@/lib/data/contracts/messaggiInterni";

function toIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(String(value ?? ""));
  return Number.isNaN(parsed.getTime()) ? String(value ?? "") : parsed.toISOString();
}

function mapRow(row: Record<string, unknown>): MessaggioInternoDto {
  const fromUser =
    row.FromUserId && row.FromUserName
      ? { id: String(row.FromUserId), name: String(row.FromUserName) }
      : undefined;

  const toUser =
    row.ToUserId && row.ToUserName
      ? { id: String(row.ToUserId), name: String(row.ToUserName) }
      : undefined;

  const pratica =
    row.PraticaId && row.PraticaNumero
      ? {
          id: String(row.PraticaId),
          numero: String(row.PraticaNumero),
          debitore:
            row.DebitoreNome || row.DebitoreCognome
              ? {
                  nome: String(row.DebitoreNome ?? ""),
                  cognome: String(row.DebitoreCognome ?? ""),
                }
              : undefined,
        }
      : undefined;

  return {
    id: String(row.Id),
    praticaId: row.PraticaIdRaw != null ? String(row.PraticaIdRaw) : null,
    fromUserId: String(row.FromUserIdRaw),
    toUserId: String(row.ToUserIdRaw),
    testo: String(row.Testo),
    letto: Boolean(row.Letto),
    lettoAt: row.LettoAt != null ? toIso(row.LettoAt) : null,
    createdAt: toIso(row.CreatedAt),
    fromUser,
    toUser,
    pratica,
  };
}

export class NeonMessaggiInterniRepository implements MessaggiInterniRepository {
  constructor(private _tenantSlug: string) {}

  async list(
    _tenantSlug: string,
    tenantId: string,
    filter?: MessaggioInternoFilter
  ): Promise<MessaggioInternoDto[]> {
    const where: string[] = [`m."TenantId" = $1::uuid`];
    const params: unknown[] = [tenantId];
    let i = 2;

    if (filter?.toUserId) {
      where.push(`m."ToUserId" = $${i++}::uuid`);
      params.push(filter.toUserId);
    }
    if (filter?.fromUserId) {
      where.push(`m."FromUserId" = $${i++}::uuid`);
      params.push(filter.fromUserId);
    }
    if (filter?.userId) {
      where.push(`(m."ToUserId" = $${i}::uuid OR m."FromUserId" = $${i}::uuid)`);
      params.push(filter.userId);
      i++;
    }
    if (filter?.letto === false) where.push(`m."Letto" = false`);

    const take = filter?.take ?? 100;
    params.push(take);

    const rows = await neonQuery<Record<string, unknown>>(
      `SELECT m."Id", m."PraticaId" AS "PraticaIdRaw",
              m."FromUserId" AS "FromUserIdRaw", m."ToUserId" AS "ToUserIdRaw",
              m."Testo", m."Letto", m."LettoAt", m."CreatedAt",
              fu."Id" AS "FromUserId", fu."Name" AS "FromUserName",
              tu."Id" AS "ToUserId", tu."Name" AS "ToUserName",
              p."Id" AS "PraticaId", p."Numero" AS "PraticaNumero",
              d."Nome" AS "DebitoreNome", d."Cognome" AS "DebitoreCognome"
       FROM "MessaggiInterni" m
       LEFT JOIN "Users" fu ON fu."Id" = m."FromUserId"
       LEFT JOIN "Users" tu ON tu."Id" = m."ToUserId"
       LEFT JOIN "Pratiche" p ON p."Id" = m."PraticaId"
       LEFT JOIN "Debitori" d ON d."Id" = p."DebitoreId"
       WHERE ${where.join(" AND ")}
       ORDER BY m."CreatedAt" DESC
       LIMIT $${params.length}`,
      params
    );
    return rows.map(mapRow);
  }

  async createMany(
    _tenantSlug: string,
    tenantId: string,
    items: Array<{ fromUserId: string; toUserId: string; praticaId?: string | null; testo: string }>
  ): Promise<void> {
    if (!items.length) return;

    const placeholders: string[] = [];
    const params: unknown[] = [];
    let i = 1;

    for (const item of items) {
      placeholders.push(
        `($${i++}::uuid, $${i++}::uuid, $${i++}::uuid, $${i++}::uuid, $${i++}::uuid, $${i++}, false, NULL, NOW())`
      );
      params.push(
        crypto.randomUUID(),
        tenantId,
        item.fromUserId,
        item.toUserId,
        item.praticaId ?? null,
        item.testo
      );
    }

    await neonQuery(
      `INSERT INTO "MessaggiInterni"
         ("Id","TenantId","FromUserId","ToUserId","PraticaId","Testo","Letto","LettoAt","CreatedAt")
       VALUES ${placeholders.join(", ")}`,
      params
    );
  }

  async getById(
    _tenantSlug: string,
    tenantId: string,
    id: string
  ): Promise<MessaggioInternoDto | null> {
    const rows = await neonQuery<Record<string, unknown>>(
      `SELECT m."Id", m."PraticaId" AS "PraticaIdRaw",
              m."FromUserId" AS "FromUserIdRaw", m."ToUserId" AS "ToUserIdRaw",
              m."Testo", m."Letto", m."LettoAt", m."CreatedAt",
              fu."Id" AS "FromUserId", fu."Name" AS "FromUserName",
              tu."Id" AS "ToUserId", tu."Name" AS "ToUserName",
              p."Id" AS "PraticaId", p."Numero" AS "PraticaNumero",
              d."Nome" AS "DebitoreNome", d."Cognome" AS "DebitoreCognome"
       FROM "MessaggiInterni" m
       LEFT JOIN "Users" fu ON fu."Id" = m."FromUserId"
       LEFT JOIN "Users" tu ON tu."Id" = m."ToUserId"
       LEFT JOIN "Pratiche" p ON p."Id" = m."PraticaId"
       LEFT JOIN "Debitori" d ON d."Id" = p."DebitoreId"
       WHERE m."Id" = $1::uuid AND m."TenantId" = $2::uuid
       LIMIT 1`,
      [id, tenantId]
    );
    return rows[0] ? mapRow(rows[0]) : null;
  }

  async markLetto(
    _tenantSlug: string,
    tenantId: string,
    id: string,
    letto: boolean
  ): Promise<void> {
    await neonQuery(
      `UPDATE "MessaggiInterni"
       SET "Letto" = $1, "LettoAt" = ${letto ? "NOW()" : "NULL"}
       WHERE "Id" = $2::uuid AND "TenantId" = $3::uuid`,
      [letto, id, tenantId]
    );
  }

  async updateTesto(_tenantSlug: string, tenantId: string, id: string, testo: string): Promise<void> {
    await neonQuery(
      `UPDATE "MessaggiInterni"
       SET "Testo" = $1, "Letto" = false, "LettoAt" = NULL
       WHERE "Id" = $2::uuid AND "TenantId" = $3::uuid`,
      [testo, id, tenantId]
    );
  }

  async delete(_tenantSlug: string, tenantId: string, id: string): Promise<void> {
    await neonQuery(
      `DELETE FROM "MessaggiInterni"
       WHERE "Id" = $1::uuid AND "TenantId" = $2::uuid`,
      [id, tenantId]
    );
  }

  async deleteByPratica(_tenantSlug: string, tenantId: string, praticaId: string): Promise<void> {
    await neonQuery(
      `DELETE FROM "MessaggiInterni"
       WHERE "PraticaId" = $1::uuid AND "TenantId" = $2::uuid`,
      [praticaId, tenantId]
    );
  }
}

export function createNeonMessaggiInterniRepository(tenantSlug: string) {
  return new NeonMessaggiInterniRepository(tenantSlug);
}
