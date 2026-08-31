import "server-only";
import { connectorFetch } from "./ConnectorClient";
import { mapSqlRow } from "../mapSqlRow";
import type {
  UserCreateInput,
  UserFilter,
  UserInclude,
  UserListRequest,
  UserUpdateInput,
  UsersOperationalRepository,
} from "../contracts/users";

function mapUserRow(row: Record<string, unknown>) {
  const mapped = mapSqlRow(row);
  if (row.GruppoMandantiJson != null && mapped.gruppoMandanti == null) {
    mapped.gruppoMandanti = row.GruppoMandantiJson;
  }
  if (row.SedeNome != null) {
    mapped.sede = { nome: row.SedeNome };
  }
  if (row.SupervisorName != null) {
    mapped.supervisor = { name: row.SupervisorName };
  }
  if (row.PostazioneNome != null || row.PostazioneInterno != null) {
    mapped.postazione = {
      nome: row.PostazioneNome ?? null,
      interno: row.PostazioneInterno ?? null,
      email: row.PostazioneEmail ?? null,
      numeroFisso: row.PostazioneNumeroFisso ?? null,
      sedeRef: row.PostazioneSedeNome ? { nome: row.PostazioneSedeNome } : null,
    };
  }
  return mapped;
}

export class ConnectorUsersAdminRepository implements UsersOperationalRepository {
  constructor(private tenantSlug: string) {}

  private base(slug?: string) {
    return `/api/v1/tenants/${encodeURIComponent(slug ?? this.tenantSlug)}/users`;
  }

  async list(req: UserListRequest) {
    const orderBy =
      req.orderBy?.name != null
        ? "name"
        : req.orderBy?.email != null
          ? "email"
          : req.orderBy?.role != null
            ? "role"
            : req.orderBy?.lastLoginAt != null
              ? "lastLoginAt"
              : req.orderBy?.createdAt != null
                ? "createdAt"
                : "name";
    const orderDir =
      req.orderBy?.name ??
      req.orderBy?.email ??
      req.orderBy?.role ??
      req.orderBy?.lastLoginAt ??
      req.orderBy?.createdAt ??
      "asc";
    const data = await connectorFetch<{ items: Record<string, unknown>[]; total: number }>(
      `${this.base(req.tenantSlug)}/list`,
      {
        method: "POST",
        body: {
          filter: req.filter,
          orderBy,
          orderDir,
          skip: req.skip,
          take: req.take,
          include: req.include,
        },
      }
    );
    return { items: data.items.map(mapUserRow), total: data.total };
  }

  async count(tenantSlug: string, tenantId: string, filter?: UserFilter) {
    const data = await connectorFetch<{ total: number }>(`${this.base(tenantSlug)}/count`, {
      method: "POST",
      body: { filter: { ...filter, tenantId } },
    });
    return data.total;
  }

  async getById(
    tenantSlug: string,
    tenantId: string,
    id: string,
    opts?: { include?: UserInclude; select?: Record<string, unknown> }
  ) {
    const q = opts?.include ? `?include=${encodeURIComponent(JSON.stringify(opts.include))}` : "";
    const data = await connectorFetch<{ item: Record<string, unknown> | null }>(
      `${this.base(tenantSlug)}/${encodeURIComponent(id)}${q}`
    );
    return data.item ? mapUserRow(data.item) : null;
  }

  async findByEmail(
    tenantSlug: string,
    tenantId: string,
    email: string,
    opts?: { include?: UserInclude; select?: Record<string, unknown> }
  ) {
    const data = await connectorFetch<{ item: Record<string, unknown> | null }>(
      `${this.base(tenantSlug)}/by-email`,
      { method: "POST", body: { tenantId, email, include: opts?.include } }
    );
    return data.item ? mapUserRow(data.item) : null;
  }

  async create(tenantSlug: string, data: UserCreateInput) {
    const res = await connectorFetch<{ item: Record<string, unknown> }>(`${this.base(tenantSlug)}/`, {
      method: "POST",
      body: data,
    });
    return mapUserRow(res.item);
  }

  async update(tenantSlug: string, tenantId: string, id: string, data: UserUpdateInput) {
    const res = await connectorFetch<{ item: Record<string, unknown> }>(
      `${this.base(tenantSlug)}/${encodeURIComponent(id)}`,
      { method: "PATCH", body: data }
    );
    return mapUserRow(res.item);
  }

  async updateMany(
    tenantSlug: string,
    tenantId: string,
    filter: UserFilter,
    data: UserUpdateInput
  ) {
    const res = await connectorFetch<{ count: number }>(`${this.base(tenantSlug)}/update-many`, {
      method: "POST",
      body: { filter: { ...filter, tenantId }, data },
    });
    return { count: res.count };
  }
}

export function createConnectorUsersAdminRepository(tenantSlug: string) {
  return new ConnectorUsersAdminRepository(tenantSlug);
}
