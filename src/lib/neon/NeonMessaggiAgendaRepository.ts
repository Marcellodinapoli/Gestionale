import "server-only";
import { neonQuery } from "@/lib/neon/pool";
import type {
  MessaggiAgendaRepository,
  MessaggioAgendaDto,
  MessaggioAgendaFilter,
} from "@/lib/data/contracts/messaggiAgenda";

function toIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(String(value ?? ""));
  return Number.isNaN(parsed.getTime()) ? String(value ?? "") : parsed.toISOString();
}

function mapRow(row: Record<string, unknown>): MessaggioAgendaDto {
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

  const user =
    row.UserId && row.UserName
      ? { id: String(row.UserId), name: String(row.UserName) }
      : undefined;

  return {
    id: String(row.Id),
    praticaId: String(row.PraticaIdRaw),
    userId: String(row.UserIdRaw),
    memoAt: toIso(row.MemoAt),
    line: String(row.Line),
    letto: Boolean(row.Letto),
    lettoAt: row.LettoAt != null ? toIso(row.LettoAt) : null,
    createdAt: toIso(row.CreatedAt),
    pratica,
    user,
  };
}

export class NeonMessaggiAgendaRepository implements MessaggiAgendaRepository {
  constructor(private _tenantSlug: string) {}

  async list(
    _tenantSlug: string,
    tenantId: string,
    filter?: MessaggioAgendaFilter
  ): Promise<MessaggioAgendaDto[]> {
    const where: string[] = [`m."TenantId" = $1::uuid`];
    const params: unknown[] = [tenantId];
    let i = 2;

    if (filter?.praticaId) {
      where.push(`m."PraticaId" = $${i++}::uuid`);
      params.push(filter.praticaId);
    }
    if (filter?.letto === false) where.push(`m."Letto" = false`);
    if (filter?.letto === true) where.push(`m."Letto" = true`);

    const take = filter?.take ?? 100;
    params.push(take);

    const rows = await neonQuery<Record<string, unknown>>(
      `SELECT m."Id", m."PraticaId" AS "PraticaIdRaw", m."UserId" AS "UserIdRaw",
              m."MemoAt", m."Line", m."Letto", m."LettoAt", m."CreatedAt",
              p."Id" AS "PraticaId", p."Numero" AS "PraticaNumero",
              d."Nome" AS "DebitoreNome", d."Cognome" AS "DebitoreCognome",
              u."Id" AS "UserId", u."Name" AS "UserName"
       FROM "MessaggiAgenda" m
       LEFT JOIN "Pratiche" p ON p."Id" = m."PraticaId"
       LEFT JOIN "Debitori" d ON d."Id" = p."DebitoreId"
       LEFT JOIN "Users" u ON u."Id" = m."UserId"
       WHERE ${where.join(" AND ")}
       ORDER BY m."CreatedAt" DESC
       LIMIT $${params.length}`,
      params
    );
    return rows.map(mapRow);
  }

  async findOpenByPratica(
    _tenantSlug: string,
    tenantId: string,
    praticaId: string
  ): Promise<MessaggioAgendaDto | null> {
    const rows = await neonQuery<Record<string, unknown>>(
      `SELECT m."Id", m."PraticaId" AS "PraticaIdRaw", m."UserId" AS "UserIdRaw",
              m."MemoAt", m."Line", m."Letto", m."LettoAt", m."CreatedAt",
              NULL AS "PraticaId", NULL AS "PraticaNumero",
              NULL AS "DebitoreNome", NULL AS "DebitoreCognome",
              NULL AS "UserId", NULL AS "UserName"
       FROM "MessaggiAgenda" m
       WHERE m."PraticaId" = $1::uuid AND m."TenantId" = $2::uuid AND m."Letto" = false
       ORDER BY m."CreatedAt" DESC
       LIMIT 1`,
      [praticaId, tenantId]
    );
    return rows[0] ? mapRow(rows[0]) : null;
  }

  async upsertOpen(
    _tenantSlug: string,
    tenantId: string,
    data: { praticaId: string; userId: string; memoAt: Date | string; line: string }
  ): Promise<void> {
    const aperto = await this.findOpenByPratica(_tenantSlug, tenantId, data.praticaId);
    if (aperto) {
      await neonQuery(
        `UPDATE "MessaggiAgenda"
         SET "MemoAt" = $1::timestamptz, "Line" = $2, "UserId" = $3::uuid
         WHERE "Id" = $4::uuid AND "TenantId" = $5::uuid`,
        [new Date(data.memoAt).toISOString(), data.line, data.userId, aperto.id, tenantId]
      );
      return;
    }

    await neonQuery(
      `INSERT INTO "MessaggiAgenda"
         ("Id","TenantId","PraticaId","UserId","MemoAt","Line","Letto","LettoAt","CreatedAt")
       VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::timestamptz,$6,false,NULL,NOW())`,
      [
        crypto.randomUUID(),
        tenantId,
        data.praticaId,
        data.userId,
        new Date(data.memoAt).toISOString(),
        data.line,
      ]
    );
  }

  async markLetto(_tenantSlug: string, tenantId: string, id: string): Promise<void> {
    await neonQuery(
      `UPDATE "MessaggiAgenda"
       SET "Letto" = true, "LettoAt" = NOW()
       WHERE "Id" = $1::uuid AND "TenantId" = $2::uuid`,
      [id, tenantId]
    );
  }

  async markPraticaLetti(
    _tenantSlug: string,
    tenantId: string,
    praticaId: string
  ): Promise<void> {
    await neonQuery(
      `UPDATE "MessaggiAgenda"
       SET "Letto" = true, "LettoAt" = NOW()
       WHERE "PraticaId" = $1::uuid AND "TenantId" = $2::uuid AND "Letto" = false`,
      [praticaId, tenantId]
    );
  }

  async deleteByPratica(
    _tenantSlug: string,
    tenantId: string,
    praticaId: string
  ): Promise<void> {
    await neonQuery(
      `DELETE FROM "MessaggiAgenda"
       WHERE "PraticaId" = $1::uuid AND "TenantId" = $2::uuid`,
      [praticaId, tenantId]
    );
  }

  async getById(
    _tenantSlug: string,
    tenantId: string,
    id: string
  ): Promise<MessaggioAgendaDto | null> {
    const rows = await neonQuery<Record<string, unknown>>(
      `SELECT m."Id", m."PraticaId" AS "PraticaIdRaw", m."UserId" AS "UserIdRaw",
              m."MemoAt", m."Line", m."Letto", m."LettoAt", m."CreatedAt",
              p."Id" AS "PraticaId", p."Numero" AS "PraticaNumero",
              d."Nome" AS "DebitoreNome", d."Cognome" AS "DebitoreCognome",
              u."Id" AS "UserId", u."Name" AS "UserName"
       FROM "MessaggiAgenda" m
       LEFT JOIN "Pratiche" p ON p."Id" = m."PraticaId"
       LEFT JOIN "Debitori" d ON d."Id" = p."DebitoreId"
       LEFT JOIN "Users" u ON u."Id" = m."UserId"
       WHERE m."Id" = $1::uuid AND m."TenantId" = $2::uuid
       LIMIT 1`,
      [id, tenantId]
    );
    return rows[0] ? mapRow(rows[0]) : null;
  }
}

export function createNeonMessaggiAgendaRepository(tenantSlug: string) {
  return new NeonMessaggiAgendaRepository(tenantSlug);
}
