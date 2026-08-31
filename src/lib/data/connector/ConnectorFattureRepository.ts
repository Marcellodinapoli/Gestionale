import "server-only";
import { connectorFetch } from "./ConnectorClient";
import { mapSqlRow } from "../mapSqlRow";
import type { FatturaCreateInput, FatturaFilter, FattureRepository } from "../contracts/fatture";

export class ConnectorFattureRepository implements FattureRepository {
  constructor(private tenantSlug: string) {}

  private base(slug?: string) {
    return `/api/v1/tenants/${encodeURIComponent(slug ?? this.tenantSlug)}/fatture`;
  }

  async create(tenantSlug: string, _tenantId: string, data: FatturaCreateInput) {
    const res = await connectorFetch<{ item: Record<string, unknown> }>(`${this.base(tenantSlug)}/`, {
      method: "POST",
      body: data,
    });
    return mapSqlRow(res.item);
  }

  async deleteMany(tenantSlug: string, _tenantId: string, filter: FatturaFilter) {
    return connectorFetch<{ count: number }>(`${this.base(tenantSlug)}/delete-many`, {
      method: "POST",
      body: { praticaId: filter.praticaId },
    });
  }
}

export function createConnectorFattureRepository(tenantSlug: string) {
  return new ConnectorFattureRepository(tenantSlug);
}
