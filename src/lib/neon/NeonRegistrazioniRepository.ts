import "server-only";
import { neonQuery } from "@/lib/neon/pool";
import { mapSqlRow } from "@/lib/data/mapSqlRow";
import type {
  RegistrazioneCreateInput,
  RegistrazioneDto,
  RegistrazioneFilter,
  RegistrazioneListRequest,
  RegistrazioniRepository,
} from "@/lib/data/contracts/registrazioni";

function mapRow(row: Record<string, unknown>): RegistrazioneDto {
  const mapped = mapSqlRow(row);
  if (typeof mapped.createdAt === "string") {
    mapped.createdAt = new Date(mapped.createdAt);
  }
  if (row.OperatoreId && row.OperatoreName) {
    mapped.operatore = { id: String(row.OperatoreId), name: String(row.OperatoreName) };
  }
  if (row.PraticaId && row.PraticaNumero) {
    mapped.pratica = {
      id: String(row.PraticaId),
      numero: String(row.PraticaNumero),
      debitore:
        row.DebitoreNome || row.DebitoreCognome
          ? {
              nome: String(row.DebitoreNome ?? ""),
              cognome: String(row.DebitoreCognome ?? ""),
            }
          : undefined,
    };
  }
  return mapped;
}

function buildWhere(
  tenantId: string,
  filter?: RegistrazioneFilter
): { sql: string; params: unknown[] } {
  if (filter?.none) return { sql: "FALSE", params: [] };

  const where: string[] = [`r."TenantId" = $1::uuid`];
  const params: unknown[] = [tenantId];
  let i = 2;

  if (filter?.id) {
    where.push(`r."Id" = $${i++}::uuid`);
    params.push(filter.id);
  }
  if (filter?.praticaId) {
    where.push(`r."PraticaId" = $${i++}::uuid`);
    params.push(filter.praticaId);
  }
  if (filter?.praticaIdsIn?.length) {
    if (filter.praticaIdsIn.length === 0) where.push("FALSE");
    else {
      where.push(`r."PraticaId" = ANY($${i++}::uuid[])`);
      params.push(filter.praticaIdsIn);
    }
  }
  if (filter?.operatoreId) {
    where.push(`r."OperatoreId" = $${i++}::uuid`);
    params.push(filter.operatoreId);
  }
  if (filter?.operatoreIdIn?.length) {
    where.push(`r."OperatoreId" = ANY($${i++}::uuid[])`);
    params.push(filter.operatoreIdIn);
  }
  if (filter?.evidenzaBackOffice === true) {
    where.push(`r."EvidenzaBackOffice" = true`);
  }
  if (filter?.createdAtGte) {
    where.push(`r."CreatedAt" >= $${i++}::timestamptz`);
    params.push(filter.createdAtGte);
  }
  if (filter?.createdAtLte) {
    where.push(`r."CreatedAt" <= $${i++}::timestamptz`);
    params.push(filter.createdAtLte);
  }
  if (filter?.search) {
    where.push(
      `(p."Numero" ILIKE $${i} OR u."Name" ILIKE $${i})`
    );
    params.push(`%${filter.search}%`);
    i++;
  }

  return { sql: where.join(" AND "), params };
}

export class NeonRegistrazioniRepository implements RegistrazioniRepository {
  constructor(private _tenantSlug: string) {}

  async list(req: RegistrazioneListRequest): Promise<{ items: RegistrazioneDto[]; total: number }> {
    const { sql, params } = buildWhere(req.tenantId, req.filter);
    const take = Math.min(req.take ?? 100, 500);
    const skip = req.skip ?? 0;
    const order = req.orderBy?.createdAt === "asc" ? "ASC" : "DESC";

    const operatoreCol = req.includeOperatore
      ? `, u."Id" AS "OperatoreId", u."Name" AS "OperatoreName"`
      : "";
    const praticaCol = req.includePraticaDebitore
      ? `, p."Id" AS "PraticaId", p."Numero" AS "PraticaNumero", d."Nome" AS "DebitoreNome", d."Cognome" AS "DebitoreCognome"`
      : "";

    const operatoreJoin = req.includeOperatore
      ? `LEFT JOIN "Users" u ON u."Id" = r."OperatoreId"`
      : "";
    const praticaJoin = req.includePraticaDebitore
      ? `LEFT JOIN "Pratiche" p ON p."Id" = r."PraticaId" LEFT JOIN "Debitori" d ON d."Id" = p."DebitoreId"`
      : "";

    params.push(take, skip);

    const rows = await neonQuery<Record<string, unknown>>(
      `SELECT r."Id", r."TenantId", r."PraticaId", r."OperatoreId", r."Numero",
              r."Direzione", r."Stato", r."Esito", r."DurataSec", r."FileName",
              r."EvidenzaBackOffice", r."CreatedAt"${operatoreCol}${praticaCol}
       FROM "RegistrazioniChiamate" r
       ${operatoreJoin}
       ${praticaJoin}
       WHERE ${sql}
       ORDER BY r."CreatedAt" ${order}
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    // Per il totale, faccio una query count separata (più semplice)
    const countRows = await neonQuery<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM "RegistrazioniChiamate" r WHERE ${sql}`,
      params.slice(0, -2) // rimuovo limit e offset
    );

    return {
      items: rows.map(mapRow),
      total: countRows[0]?.count ?? 0,
    };
  }

  async findFirst(
    _tenantSlug: string,
    tenantId: string,
    filter: RegistrazioneFilter
  ): Promise<RegistrazioneDto | null> {
    const { sql, params } = buildWhere(tenantId, filter);
    const rows = await neonQuery<Record<string, unknown>>(
      `SELECT r."Id", r."TenantId", r."PraticaId", r."OperatoreId", r."Numero",
              r."Direzione", r."Stato", r."Esito", r."DurataSec", r."FileName",
              r."EvidenzaBackOffice", r."CreatedAt"
       FROM "RegistrazioniChiamate" r
       WHERE ${sql}
       ORDER BY r."CreatedAt" DESC
       LIMIT 1`,
      params
    );
    return rows[0] ? mapRow(rows[0]) : null;
  }

  async create(
    _tenantSlug: string,
    tenantId: string,
    data: RegistrazioneCreateInput
  ): Promise<RegistrazioneDto> {
    const id = crypto.randomUUID();
    await neonQuery(
      `INSERT INTO "RegistrazioniChiamate"
         ("Id","TenantId","PraticaId","OperatoreId","Numero","Direzione","Stato","Esito",
          "DurataSec","FileName","EvidenzaBackOffice","CreatedAt")
       VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5,$6,$7,$8,$9,$10,$11,NOW())`,
      [
        id,
        tenantId,
        data.praticaId,
        data.operatoreId,
        data.numero,
        data.direzione ?? null,
        data.stato ?? null,
        data.esito ?? null,
        data.durataSec ?? 0,
        data.fileName ?? "",
        data.evidenzaBackOffice ?? false,
      ]
    );

    const row = await this.findFirst(_tenantSlug, tenantId, { id });
    if (!row) throw new Error("Creazione registrazione fallita");
    return row;
  }

  async deleteMany(
    _tenantSlug: string,
    tenantId: string,
    filter: RegistrazioneFilter
  ): Promise<{ count: number }> {
    const { sql, params } = buildWhere(tenantId, filter);
    const rows = await neonQuery<{ count: number }>(
      `WITH deleted AS (
         DELETE FROM "RegistrazioniChiamate" r
         WHERE ${sql}
         RETURNING 1
       )
       SELECT COUNT(*)::int AS count FROM deleted`,
      params
    );
    return { count: rows[0]?.count ?? 0 };
  }
}

export function createNeonRegistrazioniRepository(tenantSlug: string) {
  return new NeonRegistrazioniRepository(tenantSlug);
}
