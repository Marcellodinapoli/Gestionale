import "server-only";
import { connectorFetch } from "./ConnectorClient";
import { mapSqlRow } from "../mapSqlRow";
import type {
  PostazioneCreateInput,
  PostazioneFilter,
  PostazioneListOptions,
  PostazioneUpdateInput,
  PostazioniRepository,
} from "../contracts/postazioni";

export class ConnectorPostazioniRepository implements PostazioniRepository {
  constructor(private tenantSlug: string) {}

  private base(slug?: string) {
    return `/api/v1/tenants/${encodeURIComponent(slug ?? this.tenantSlug)}/postazioni`;
  }

  async list(tenantSlug: string, tenantId: string, filter?: PostazioneListOptions) {
    const data = await connectorFetch<{ items: Record<string, unknown>[] }>(
      `${this.base(tenantSlug)}/list`,
      {
        method: "POST",
        body: {
          filter: { ...filter, tenantId },
          orderBy: filter?.orderBy,
          orderDir: filter?.orderDir,
          take: filter?.take,
          includeSede: filter?.includeSede,
          includeOccupants: filter?.includeOccupants,
          excludeOccupantUserId: filter?.excludeOccupantUserId,
        },
      }
    );
    return data.items.map(mapSqlRow) as import("../contracts/postazioni").PostazioneDto[];
  }

  async count(tenantSlug: string, tenantId: string, filter?: PostazioneFilter) {
    const data = await connectorFetch<{ total: number }>(`${this.base(tenantSlug)}/count`, {
      method: "POST",
      body: { filter: { ...filter, tenantId } },
    });
    return data.total;
  }

  async getById(tenantSlug: string, tenantId: string, id: string) {
    const data = await connectorFetch<{ item: Record<string, unknown> | null }>(
      `${this.base(tenantSlug)}/${encodeURIComponent(id)}`
    );
    return data.item ? (mapSqlRow(data.item) as import("../contracts/postazioni").PostazioneDto) : null;
  }

  async findByNome(tenantSlug: string, tenantId: string, nome: string, excludeId?: string) {
    const items = await this.list(tenantSlug, tenantId, { nome, excludeId, take: 1 });
    return items[0] ?? null;
  }

  async create(tenantSlug: string, data: PostazioneCreateInput) {
    const res = await connectorFetch<{ item: Record<string, unknown> }>(
      `${this.base(tenantSlug)}/`,
      {
        method: "POST",
        body: data,
      }
    );
    return mapSqlRow(res.item) as import("../contracts/postazioni").PostazioneDto;
  }

  async update(tenantSlug: string, tenantId: string, id: string, data: PostazioneUpdateInput) {
    const res = await connectorFetch<{ item: Record<string, unknown> }>(
      `${this.base(tenantSlug)}/${encodeURIComponent(id)}`,
      { method: "PATCH", body: data }
    );
    return mapSqlRow(res.item) as import("../contracts/postazioni").PostazioneDto;
  }

  async delete(tenantSlug: string, tenantId: string, id: string) {
    await connectorFetch<{ ok: boolean }>(
      `${this.base(tenantSlug)}/${encodeURIComponent(id)}`,
      { method: "DELETE" }
    );
  }
}

export function createConnectorPostazioniRepository(tenantSlug: string) {
  return new ConnectorPostazioniRepository(tenantSlug);
}
