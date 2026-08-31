import "server-only";
import { connectorFetch } from "./ConnectorClient";
import { mapSqlRow } from "../mapSqlRow";
import type {
  AttivitaCreateInput,
  AttivitaFilter,
  AttivitaListRequest,
  AttivitaRepository,
  AttivitaUpdateInput,
} from "../contracts/attivita";

function mapAttivitaRow(row: Record<string, unknown>) {
  const mapped = mapSqlRow(row);
  if (row.user && typeof row.user === "object") {
    mapped.user = mapSqlRow(row.user as Record<string, unknown>);
  }
  return mapped;
}

export class ConnectorAttivitaRepository implements AttivitaRepository {
  constructor(private tenantSlug: string) {}

  private base(slug?: string) {
    return `/api/v1/tenants/${encodeURIComponent(slug ?? this.tenantSlug)}/attivita`;
  }

  async list(req: AttivitaListRequest) {
    const data = await connectorFetch<{ items: Record<string, unknown>[]; total: number }>(
      `${this.base(req.tenantSlug)}/list`,
      {
        method: "POST",
        body: {
          filter: req.filter,
          skip: req.skip,
          take: req.take,
          orderBy: req.orderBy,
          includeUser: req.includeUser,
        },
      }
    );
    return { items: data.items.map(mapAttivitaRow), total: data.total };
  }

  async count(tenantSlug: string, _tenantId: string, filter?: AttivitaFilter) {
    const data = await connectorFetch<{ total: number }>(`${this.base(tenantSlug)}/count`, {
      method: "POST",
      body: { filter },
    });
    return data.total;
  }

  async groupByUserId(tenantSlug: string, _tenantId: string, filter?: AttivitaFilter) {
    const data = await connectorFetch<{ items: Array<{ userId: string; _count: number }> }>(
      `${this.base(tenantSlug)}/group-by-user`,
      { method: "POST", body: { filter } }
    );
    return data.items;
  }

  async getById(tenantSlug: string, _tenantId: string, id: string) {
    const data = await connectorFetch<{ item: Record<string, unknown> | null }>(
      `${this.base(tenantSlug)}/${encodeURIComponent(id)}`
    );
    return data.item ? mapAttivitaRow(data.item) : null;
  }

  async create(tenantSlug: string, _tenantId: string, body: AttivitaCreateInput) {
    const res = await connectorFetch<{ item: Record<string, unknown> }>(`${this.base(tenantSlug)}/`, {
      method: "POST",
      body,
    });
    return mapAttivitaRow(res.item);
  }

  async update(tenantSlug: string, _tenantId: string, id: string, data: AttivitaUpdateInput) {
    const res = await connectorFetch<{ item: Record<string, unknown> }>(
      `${this.base(tenantSlug)}/${encodeURIComponent(id)}`,
      { method: "PATCH", body: data }
    );
    return mapAttivitaRow(res.item);
  }

  async updateMany(
    tenantSlug: string,
    _tenantId: string,
    filter: AttivitaFilter,
    data: AttivitaUpdateInput
  ) {
    return connectorFetch<{ count: number }>(`${this.base(tenantSlug)}/update-many`, {
      method: "POST",
      body: { filter, data },
    });
  }

  async deleteMany(tenantSlug: string, _tenantId: string, filter: AttivitaFilter) {
    return connectorFetch<{ count: number }>(`${this.base(tenantSlug)}/delete-many`, {
      method: "POST",
      body: { filter },
    });
  }

  async toggleFissa(
    tenantSlug: string,
    _tenantId: string,
    attivitaId: string,
    praticaId: string,
    fissata: boolean
  ) {
    await connectorFetch(`${this.base(tenantSlug)}/toggle-fissa`, {
      method: "POST",
      body: { attivitaId, praticaId, fissata },
    });
  }
}

export function createConnectorAttivitaRepository(tenantSlug: string) {
  return new ConnectorAttivitaRepository(tenantSlug);
}
