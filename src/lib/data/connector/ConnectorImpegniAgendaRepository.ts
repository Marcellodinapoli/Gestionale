import "server-only";
import { connectorFetch } from "./ConnectorClient";
import type {
  ImpegnoAgendaDto,
  ImpegnoAgendaFilter,
  ImpegniAgendaRepository,
} from "../contracts/impegniAgenda";

export class ConnectorImpegniAgendaRepository implements ImpegniAgendaRepository {
  constructor(private tenantSlug: string) {}

  private base(slug?: string) {
    return `/api/v1/tenants/${encodeURIComponent(slug ?? this.tenantSlug)}/impegni-agenda`;
  }

  async list(tenantSlug: string, _tenantId: string, filter?: ImpegnoAgendaFilter, take?: number) {
    const data = await connectorFetch<{ items: ImpegnoAgendaDto[] }>(`${this.base(tenantSlug)}/list`, {
      method: "POST",
      body: { filter, take },
    });
    return data.items;
  }

  async getById(tenantSlug: string, _tenantId: string, id: string) {
    const data = await connectorFetch<{ item: ImpegnoAgendaDto | null }>(`${this.base(tenantSlug)}/${id}`);
    return data.item;
  }

  async create(
    tenantSlug: string,
    _tenantId: string,
    data: { userId: string; titolo: string; nota?: string | null; memoAt: string | Date }
  ) {
    const res = await connectorFetch<{ item: ImpegnoAgendaDto }>(`${this.base(tenantSlug)}/`, {
      method: "POST",
      body: data,
    });
    return res.item;
  }

  async complete(tenantSlug: string, _tenantId: string, id: string, userId: string) {
    await connectorFetch(`${this.base(tenantSlug)}/${id}/complete`, {
      method: "POST",
      body: { userId },
    });
  }

  async update(
    tenantSlug: string,
    _tenantId: string,
    id: string,
    userId: string,
    data: { titolo?: string; nota?: string | null; memoAt?: string | Date }
  ) {
    const res = await connectorFetch<{ item: ImpegnoAgendaDto | null }>(`${this.base(tenantSlug)}/${id}`, {
      method: "PATCH",
      body: { userId, data },
    });
    return res.item;
  }

  async delete(tenantSlug: string, _tenantId: string, id: string, userId: string) {
    await connectorFetch(`${this.base(tenantSlug)}/${id}`, {
      method: "DELETE",
      body: { userId },
    });
  }
}

export function createConnectorImpegniAgendaRepository(tenantSlug: string) {
  return new ConnectorImpegniAgendaRepository(tenantSlug);
}
