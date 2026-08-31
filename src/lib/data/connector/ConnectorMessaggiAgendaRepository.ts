import "server-only";
import { connectorFetch } from "./ConnectorClient";
import type {
  MessaggiAgendaRepository,
  MessaggioAgendaDto,
  MessaggioAgendaFilter,
} from "../contracts/messaggiAgenda";

export class ConnectorMessaggiAgendaRepository implements MessaggiAgendaRepository {
  constructor(private tenantSlug: string) {}

  private base(slug?: string) {
    return `/api/v1/tenants/${encodeURIComponent(slug ?? this.tenantSlug)}/messaggi-agenda`;
  }

  async list(tenantSlug: string, _tenantId: string, filter?: MessaggioAgendaFilter) {
    const data = await connectorFetch<{ items: MessaggioAgendaDto[] }>(`${this.base(tenantSlug)}/list`, {
      method: "POST",
      body: { filter, take: filter?.take ?? 100 },
    });
    return data.items;
  }

  async findOpenByPratica(tenantSlug: string, _tenantId: string, praticaId: string) {
    const data = await connectorFetch<{ item: MessaggioAgendaDto | null }>(
      `${this.base(tenantSlug)}/open/${encodeURIComponent(praticaId)}`
    );
    return data.item;
  }

  async upsertOpen(
    tenantSlug: string,
    _tenantId: string,
    data: { praticaId: string; userId: string; memoAt: Date | string; line: string }
  ) {
    await connectorFetch(`${this.base(tenantSlug)}/upsert-open`, { method: "POST", body: data });
  }

  async markLetto(tenantSlug: string, _tenantId: string, id: string) {
    await connectorFetch(`${this.base(tenantSlug)}/${id}/letto`, { method: "POST", body: {} });
  }

  async markPraticaLetti(tenantSlug: string, _tenantId: string, praticaId: string) {
    await connectorFetch(`${this.base(tenantSlug)}/pratica/${encodeURIComponent(praticaId)}/letti`, {
      method: "POST",
      body: {},
    });
  }

  async deleteByPratica(tenantSlug: string, _tenantId: string, praticaId: string) {
    await connectorFetch(`${this.base(tenantSlug)}/pratica/${encodeURIComponent(praticaId)}`, {
      method: "DELETE",
    });
  }

  async getById(tenantSlug: string, tenantId: string, id: string) {
    const data = await connectorFetch<{ item: MessaggioAgendaDto | null }>(
      `${this.base(tenantSlug)}/${id}`
    );
    return data.item;
  }
}

export function createConnectorMessaggiAgendaRepository(tenantSlug: string) {
  return new ConnectorMessaggiAgendaRepository(tenantSlug);
}
