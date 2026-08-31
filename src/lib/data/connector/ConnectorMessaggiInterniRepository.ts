import "server-only";
import { connectorFetch } from "./ConnectorClient";
import type {
  MessaggiInterniRepository,
  MessaggioInternoDto,
  MessaggioInternoFilter,
} from "../contracts/messaggiInterni";

export class ConnectorMessaggiInterniRepository implements MessaggiInterniRepository {
  constructor(private tenantSlug: string) {}

  private base(slug?: string) {
    return `/api/v1/tenants/${encodeURIComponent(slug ?? this.tenantSlug)}/messaggi-interni`;
  }

  async list(tenantSlug: string, _tenantId: string, filter?: MessaggioInternoFilter) {
    const data = await connectorFetch<{ items: MessaggioInternoDto[] }>(`${this.base(tenantSlug)}/list`, {
      method: "POST",
      body: { filter, take: filter?.take ?? 100 },
    });
    return data.items;
  }

  async createMany(
    tenantSlug: string,
    _tenantId: string,
    items: Array<{ fromUserId: string; toUserId: string; praticaId?: string | null; testo: string }>
  ) {
    await connectorFetch(`${this.base(tenantSlug)}/create-many`, { method: "POST", body: { items } });
  }

  async getById(tenantSlug: string, _tenantId: string, id: string) {
    const data = await connectorFetch<{ item: MessaggioInternoDto | null }>(
      `${this.base(tenantSlug)}/${id}`
    );
    return data.item;
  }

  async markLetto(tenantSlug: string, _tenantId: string, id: string, letto: boolean) {
    await connectorFetch(`${this.base(tenantSlug)}/${id}/letto`, {
      method: "POST",
      body: { letto },
    });
  }

  async updateTesto(tenantSlug: string, _tenantId: string, id: string, testo: string) {
    await connectorFetch(`${this.base(tenantSlug)}/${id}`, {
      method: "PATCH",
      body: { testo },
    });
  }

  async delete(tenantSlug: string, _tenantId: string, id: string) {
    await connectorFetch(`${this.base(tenantSlug)}/${id}`, { method: "DELETE" });
  }

  async deleteByPratica(tenantSlug: string, _tenantId: string, praticaId: string) {
    await connectorFetch(`${this.base(tenantSlug)}/pratica/${encodeURIComponent(praticaId)}`, {
      method: "DELETE",
    });
  }
}

export function createConnectorMessaggiInterniRepository(tenantSlug: string) {
  return new ConnectorMessaggiInterniRepository(tenantSlug);
}
