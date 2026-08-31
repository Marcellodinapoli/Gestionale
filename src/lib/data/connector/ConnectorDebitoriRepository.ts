import "server-only";
import { connectorFetch } from "./ConnectorClient";
import { mapSqlRow } from "../mapSqlRow";
import type {
  DebitoreCreateInput,
  DebitoreListRequest,
  DebitoreUpdateInput,
  DebitoriRepository,
  RecapitoCreateInput,
} from "../contracts/debitori";

export class ConnectorDebitoriRepository implements DebitoriRepository {
  constructor(private tenantSlug: string) {}

  private base(slug?: string) {
    return `/api/v1/tenants/${encodeURIComponent(slug ?? this.tenantSlug)}/debitori`;
  }

  async list(req: DebitoreListRequest) {
    const data = await connectorFetch<{
      items: Record<string, unknown>[];
      total: number;
    }>(`${this.base(req.tenantSlug)}/list`, {
      method: "POST",
      body: { filter: req.filter, skip: req.skip, take: req.take },
    });
    return { items: data.items.map(mapSqlRow), total: data.total };
  }

  async idsByCf(tenantSlug: string, _tenantId: string, variants: string[]) {
    const data = await connectorFetch<{ items: Record<string, unknown>[] }>(
      `${this.base(tenantSlug)}/ids-by-cf`,
      { method: "POST", body: { variants } }
    );
    return data.items.map(mapSqlRow);
  }

  async getById(tenantSlug: string, _tenantId: string, id: string) {
    const data = await connectorFetch<{ item: Record<string, unknown> | null }>(
      `${this.base(tenantSlug)}/${encodeURIComponent(id)}`
    );
    return data.item ? mapSqlRow(data.item) : null;
  }

  async create(tenantSlug: string, data: DebitoreCreateInput) {
    const res = await connectorFetch<{ item: Record<string, unknown> }>(`${this.base(tenantSlug)}/`, {
      method: "POST",
      body: data,
    });
    return mapSqlRow(res.item);
  }

  async update(tenantSlug: string, tenantId: string, id: string, data: DebitoreUpdateInput) {
    const res = await connectorFetch<{ item: Record<string, unknown> }>(
      `${this.base(tenantSlug)}/${encodeURIComponent(id)}`,
      { method: "PATCH", body: data }
    );
    return mapSqlRow(res.item);
  }

  async delete(tenantSlug: string, tenantId: string, id: string) {
    await connectorFetch(`${this.base(tenantSlug)}/${encodeURIComponent(id)}`, { method: "DELETE" });
  }

  async countRecapiti(debitoreId: string, tipo?: string) {
    const data = await connectorFetch<{ total: number }>(`${this.base()}/recapiti/count`, {
      method: "POST",
      body: { debitoreId, tipo },
    });
    return data.total;
  }

  async findFirstRecapito(filter: { id?: string; debitoreId?: string; tipo?: string }) {
    const data = await connectorFetch<{ item: Record<string, unknown> | null }>(
      `${this.base()}/recapiti/find-first`,
      { method: "POST", body: filter }
    );
    return data.item ? mapSqlRow(data.item) : null;
  }

  async createRecapito(data: RecapitoCreateInput) {
    const res = await connectorFetch<{ item: Record<string, unknown> }>(
      `${this.base()}/${encodeURIComponent(data.debitoreId)}/recapiti`,
      { method: "POST", body: data }
    );
    return mapSqlRow(res.item);
  }

  async updateRecapito(id: string, data: Record<string, unknown>) {
    const res = await connectorFetch<{ item: Record<string, unknown> }>(
      `${this.base()}/recapiti/${encodeURIComponent(id)}`,
      { method: "PATCH", body: data }
    );
    return mapSqlRow(res.item);
  }

  async deleteRecapito(id: string) {
    await connectorFetch(`${this.base()}/recapiti/${encodeURIComponent(id)}`, { method: "DELETE" });
  }

  async deleteRecapitiByDebitore(debitoreId: string) {
    await connectorFetch(`${this.base()}/${encodeURIComponent(debitoreId)}/recapiti`, { method: "DELETE" });
  }
}

export function createConnectorDebitoriRepository(tenantSlug: string) {
  return new ConnectorDebitoriRepository(tenantSlug);
}
