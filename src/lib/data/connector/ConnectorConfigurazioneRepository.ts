import "server-only";
import { connectorFetch } from "./ConnectorClient";
import { mapSqlRow } from "../mapSqlRow";
import type {
  ConfigurazioneFilter,
  ConfigurazioneRepository,
  ConfigurazioneUpsertInput,
} from "../contracts/configurazione";

export class ConnectorConfigurazioneRepository implements ConfigurazioneRepository {
  constructor(private tenantSlug: string) {}

  private base(slug?: string) {
    return `/api/v1/tenants/${encodeURIComponent(slug ?? this.tenantSlug)}/configurazione`;
  }

  async list(tenantSlug: string, tenantId: string, filter?: ConfigurazioneFilter) {
    const data = await connectorFetch<{ items: Record<string, unknown>[] }>(
      `${this.base(tenantSlug)}/list`,
      { method: "POST", body: { filter: { ...filter, tenantId } } }
    );
    return data.items.map(mapSqlRow) as import("../contracts/configurazione").ConfigurazioneDto[];
  }

  async findByChiave(
    tenantSlug: string,
    _tenantId: string,
    chiave: string,
    _select?: Record<string, unknown>
  ) {
    const data = await connectorFetch<{ item: Record<string, unknown> | null }>(
      `${this.base(tenantSlug)}/${encodeURIComponent(chiave)}`
    );
    return data.item ? (mapSqlRow(data.item) as import("../contracts/configurazione").ConfigurazioneDto) : null;
  }

  async upsert(tenantSlug: string, data: ConfigurazioneUpsertInput) {
    const res = await connectorFetch<{ item: Record<string, unknown> }>(`${this.base(tenantSlug)}/upsert`, {
      method: "POST",
      body: data,
    });
    return mapSqlRow(res.item) as import("../contracts/configurazione").ConfigurazioneDto;
  }

  async deleteMany(tenantSlug: string, tenantId: string, filter: ConfigurazioneFilter) {
    const res = await connectorFetch<{ count: number }>(`${this.base(tenantSlug)}/delete-many`, {
      method: "POST",
      body: { filter: { ...filter, tenantId } },
    });
    return { count: res.count };
  }
}

export function createConnectorConfigurazioneRepository(tenantSlug: string) {
  return new ConnectorConfigurazioneRepository(tenantSlug);
}
