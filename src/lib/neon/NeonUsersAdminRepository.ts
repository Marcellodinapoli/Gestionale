import "server-only";
import { neonQuery } from "@/lib/neon/pool";
import { mapSqlRow } from "@/lib/data/mapSqlRow";
import { isUuid } from "@/lib/tenant";
import type {
  UserCreateInput,
  UserFilter,
  UserInclude,
  UserListRequest,
  UserUpdateInput,
  UsersOperationalRepository,
  UserDto,
} from "@/lib/data/contracts/users";

function mapUser(row: Record<string, unknown>): UserDto {
  const mapped = mapSqlRow(row);
  if (row.GruppoMandantiJson != null && mapped.gruppoMandanti == null) {
    mapped.gruppoMandanti = row.GruppoMandantiJson;
  }
  if (row.SedeNome != null) mapped.sede = { nome: row.SedeNome };
  if (row.SupervisorName != null) mapped.supervisor = { name: row.SupervisorName };
  if (row.PostazioneNome != null || row.PostazioneInterno != null) {
    mapped.postazione = {
      nome: row.PostazioneNome ?? null,
      interno: row.PostazioneInterno ?? null,
      email: row.PostazioneEmail ?? null,
      numeroFisso: row.PostazioneNumeroFisso ?? null,
      sedeRef: row.PostazioneSedeNome ? { nome: row.PostazioneSedeNome } : null,
    };
  }
  // Date fields
  for (const k of ["passwordChangedAt", "lastLoginAt", "lastLogoutAt", "createdAt"] as const) {
    if (typeof mapped[k] === "string") mapped[k] = new Date(String(mapped[k]));
  }
  return mapped;
}

const USER_COLS = `
  u."Id", u."TenantId", u."Email", u."Name", u."Cognome", u."PasswordHash",
  u."PasswordChangedAt", u."Role", u."Acronimo", u."FormazioneOnly",
  u."Interno", u."PrefissoChiamata", u."Active", u."SupervisorId",
  u."GruppoNome", u."GruppoMandantiJson", u."PostazioneId", u."PostazioneFissa",
  u."SedeId", u."LastLoginAt", u."LastLogoutAt", u."CreatedAt",
  u."ConsulenteEsterno", u."CreditCalcEnabled", u."CondizioneEconomica", u."ImportoFisso"
`;

async function loadUser(
  tenantId: string,
  idOrEmail: { id?: string; email?: string },
  include?: UserInclude
): Promise<UserDto | null> {
  const joins: string[] = [];
  const extra: string[] = [];
  if (include?.sede) {
    joins.push(`LEFT JOIN "Sedi" s ON s."Id" = u."SedeId"`);
    extra.push(`s."Nome" AS "SedeNome"`);
  }
  if (include?.postazione) {
    joins.push(`LEFT JOIN "Postazioni" p ON p."Id" = u."PostazioneId"`);
    joins.push(`LEFT JOIN "Sedi" ps ON ps."Id" = p."SedeId"`);
    extra.push(
      `p."Nome" AS "PostazioneNome", p."Interno" AS "PostazioneInterno",
       p."Email" AS "PostazioneEmail", p."NumeroFisso" AS "PostazioneNumeroFisso",
       ps."Nome" AS "PostazioneSedeNome"`
    );
  }
  if (include?.supervisor) {
    joins.push(`LEFT JOIN "Users" sup ON sup."Id" = u."SupervisorId"`);
    extra.push(`sup."Name" AS "SupervisorName"`);
  }
  const where = idOrEmail.id
    ? `u."Id" = $1::uuid AND u."TenantId" = $2::uuid`
    : `lower(u."Email") = lower($1) AND u."TenantId" = $2::uuid`;
  const params = idOrEmail.id
    ? [idOrEmail.id, tenantId]
    : [idOrEmail.email, tenantId];
  const rows = await neonQuery(
    `SELECT ${USER_COLS}${extra.length ? `, ${extra.join(", ")}` : ""}
     FROM "Users" u
     ${joins.join("\n")}
     WHERE ${where}
     LIMIT 1`,
    params
  );
  return rows[0] ? mapUser(rows[0] as Record<string, unknown>) : null;
}

const EMPTY_FILTER = { sql: "1 = 0", params: [] as unknown[] };

function buildFilter(tenantId: string, filter?: UserFilter): { sql: string; params: unknown[] } {
  if (!isUuid(tenantId)) return { ...EMPTY_FILTER };
  const parts = [`u."TenantId" = $1::uuid`];
  const params: unknown[] = [tenantId];
  let i = 2;
  if (!filter) return { sql: parts.join(" AND "), params };
  if (filter.id) {
    if (!isUuid(filter.id)) return { ...EMPTY_FILTER };
    parts.push(`u."Id" = $${i++}::uuid`);
    params.push(filter.id);
  }
  if (filter.idsIn?.length) {
    const ids = filter.idsIn.filter(isUuid);
    if (!ids.length) return { ...EMPTY_FILTER };
    parts.push(`u."Id" = ANY($${i++}::uuid[])`);
    params.push(ids);
  }
  if (filter.supervisorId) {
    if (!isUuid(filter.supervisorId)) return { ...EMPTY_FILTER };
    parts.push(`u."SupervisorId" = $${i++}::uuid`);
    params.push(filter.supervisorId);
  }
  if (filter.email) {
    parts.push(`lower(u."Email") = lower($${i++})`);
    params.push(filter.email);
  }
  if (typeof filter.active === "boolean") {
    parts.push(`u."Active" = $${i++}`);
    params.push(filter.active);
  }
  if (filter.role) {
    parts.push(`u."Role" = $${i++}`);
    params.push(filter.role);
  }
  if (filter.rolesIn?.length) {
    parts.push(`u."Role" = ANY($${i++}::text[])`);
    params.push(filter.rolesIn);
  }
  if (filter.excludeId) {
    parts.push(`u."Id" <> $${i++}::uuid`);
    params.push(filter.excludeId);
  }
  if (filter.excludeRole) {
    parts.push(`u."Role" <> $${i++}`);
    params.push(filter.excludeRole);
  }
  if (typeof filter.formazioneOnly === "boolean") {
    parts.push(`u."FormazioneOnly" = $${i++}`);
    params.push(filter.formazioneOnly);
  }
  return { sql: parts.join(" AND "), params };
}

export class NeonUsersAdminRepository implements UsersOperationalRepository {
  constructor(private _tenantSlug: string) {}

  async list(req: UserListRequest) {
    const { sql, params } = buildFilter(req.tenantId, req.filter);
    if (sql === "1 = 0") return { items: [], total: 0 };
    const orderCol =
      req.orderBy?.email != null
        ? `"Email"`
        : req.orderBy?.role != null
          ? `"Role"`
          : req.orderBy?.lastLoginAt != null
            ? `"LastLoginAt"`
            : req.orderBy?.createdAt != null
              ? `"CreatedAt"`
              : `"Name"`;
    const dir =
      (req.orderBy?.name ??
        req.orderBy?.email ??
        req.orderBy?.role ??
        req.orderBy?.lastLoginAt ??
        req.orderBy?.createdAt ??
        "asc") === "desc"
        ? "DESC"
        : "ASC";
    const take = req.take ?? 500;
    const skip = req.skip ?? 0;
    const countRows = await neonQuery(
      `SELECT COUNT(*)::int AS c FROM "Users" u WHERE ${sql}`,
      params
    );
    const total = Number((countRows[0] as { c: number })?.c ?? 0);
    const items = await neonQuery(
      `SELECT ${USER_COLS} FROM "Users" u WHERE ${sql}
       ORDER BY u.${orderCol} ${dir} NULLS LAST
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, take, skip]
    );
    return { items: items.map((r) => mapUser(r as Record<string, unknown>)), total };
  }

  async count(tenantSlug: string, tenantId: string, filter?: UserFilter) {
    void tenantSlug;
    const { sql, params } = buildFilter(tenantId, filter);
    if (sql === "1 = 0") return 0;
    const rows = await neonQuery(
      `SELECT COUNT(*)::int AS c FROM "Users" u WHERE ${sql}`,
      params
    );
    return Number((rows[0] as { c: number })?.c ?? 0);
  }

  async getById(
    _tenantSlug: string,
    tenantId: string,
    id: string,
    opts?: { include?: UserInclude }
  ) {
    return loadUser(tenantId, { id }, opts?.include);
  }

  async findByEmail(
    _tenantSlug: string,
    tenantId: string,
    email: string,
    opts?: { include?: UserInclude }
  ) {
    return loadUser(tenantId, { email }, opts?.include);
  }

  async create(_tenantSlug: string, data: UserCreateInput): Promise<UserDto> {
    const id = crypto.randomUUID();
    await neonQuery(
      `INSERT INTO "Users" (
         "Id","TenantId","Email","Name","PasswordHash","PasswordChangedAt","Role",
         "Active","FormazioneOnly","PostazioneFissa","CondizioneEconomica",
         "ConsulenteEsterno","CreditCalcEnabled","CreatedAt"
       ) VALUES (
         $1::uuid,$2::uuid,lower($3),$4,$5,NOW(),$6,
         true,false,false,'NESSUNA',false,false,NOW()
       )`,
      [
        id,
        data.tenantId,
        data.email,
        data.name,
        data.passwordHash,
        data.role,
      ]
    );
    const row = await this.getById(_tenantSlug, data.tenantId, id);
    if (!row) throw new Error("Creazione utente Neon fallita");
    return row;
  }

  async update(
    tenantSlug: string,
    tenantId: string,
    id: string,
    data: UserUpdateInput
  ): Promise<UserDto> {
    const sets: string[] = [];
    const params: unknown[] = [];
    let i = 1;
    const map: Record<string, string> = {
      name: "Name",
      email: "Email",
      passwordHash: "PasswordHash",
      passwordChangedAt: "PasswordChangedAt",
      role: "Role",
      interno: "Interno",
      prefissoChiamata: "PrefissoChiamata",
      postazioneId: "PostazioneId",
      postazioneFissa: "PostazioneFissa",
      sedeId: "SedeId",
      active: "Active",
    };
    for (const [k, col] of Object.entries(map)) {
      if ((data as Record<string, unknown>)[k] !== undefined) {
        const val = (data as Record<string, unknown>)[k];
        if (col === "PostazioneId" || col === "SedeId") {
          if (val == null) sets.push(`"${col}" = NULL`);
          else {
            sets.push(`"${col}" = $${i++}::uuid`);
            params.push(val);
          }
        } else if (col === "PasswordChangedAt") {
          sets.push(`"${col}" = $${i++}`);
          params.push(val instanceof Date ? val.toISOString() : val);
        } else {
          sets.push(`"${col}" = $${i++}`);
          params.push(val);
        }
      }
    }
    if (!sets.length) {
      const row = await this.getById(tenantSlug, tenantId, id);
      if (!row) throw new Error("Utente non trovato");
      return row;
    }
    params.push(id, tenantId);
    await neonQuery(
      `UPDATE "Users" SET ${sets.join(", ")}
       WHERE "Id" = $${i++}::uuid AND "TenantId" = $${i}::uuid`,
      params
    );
    const row = await this.getById(tenantSlug, tenantId, id);
    if (!row) throw new Error("Utente non trovato");
    return row;
  }

  async updateMany(
    tenantSlug: string,
    tenantId: string,
    filter: UserFilter,
    data: UserUpdateInput
  ) {
    const listed = await this.list({
      tenantSlug,
      tenantId,
      filter,
      take: 10_000,
    });
    let count = 0;
    for (const u of listed.items) {
      await this.update(tenantSlug, tenantId, String(u.id), data);
      count += 1;
    }
    return { count };
  }
}

export function createNeonUsersAdminRepository(tenantSlug: string) {
  return new NeonUsersAdminRepository(tenantSlug);
}
