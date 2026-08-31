import "server-only";
import { connectorFetch } from "./ConnectorClient";
import { mapSqlRow } from "../mapSqlRow";
import type {
  PianoRataCreateInput,
  PianoRataFilter,
  PianoRateRepository,
} from "../contracts/pianoRate";

export class ConnectorPianoRateRepository implements PianoRateRepository {
  constructor(private tenantSlug: string) {}

  private base(slug?: string) {
    return `/api/v1/tenants/${encodeURIComponent(slug ?? this.tenantSlug)}/piano-rate`;
  }

  async create(tenantSlug: string, _tenantId: string, data: PianoRataCreateInput) {
    const res = await connectorFetch<{ item: Record<string, unknown> }>(`${this.base(tenantSlug)}/`, {
      method: "POST",
      body: data,
    });
    return mapSqlRow(res.item);
  }

  async createMany(tenantSlug: string, _tenantId: string, items: PianoRataCreateInput[]) {
    return connectorFetch<{ count: number }>(`${this.base(tenantSlug)}/create-many`, {
      method: "POST",
      body: { items },
    });
  }

  async deleteMany(tenantSlug: string, _tenantId: string, filter: PianoRataFilter) {
    return connectorFetch<{ count: number }>(`${this.base(tenantSlug)}/delete-many`, {
      method: "POST",
      body: { praticaId: filter.praticaId },
    });
  }
}

export function createConnectorPianoRateRepository(tenantSlug: string) {
  return new ConnectorPianoRateRepository(tenantSlug);
}
