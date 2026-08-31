import "server-only";
import { connectorFetch } from "./ConnectorClient";
import { mapSqlRow } from "../mapSqlRow";
import type {
  ProvvigioneAggregateRequest,
  ProvvigioneGroupByRequest,
  ProvvigioneListRequest,
  ProvvigioneUpdateInput,
  ProvvigioniRepository,
} from "../contracts/provvigioni";

function mapProvvigioneRow(row: Record<string, unknown>) {
  const mapped = mapSqlRow(row);
  if (row.operatore && typeof row.operatore === "object") {
    mapped.operatore = mapSqlRow(row.operatore as Record<string, unknown>);
  }
  if (row.pratica && typeof row.pratica === "object") {
    const pr = row.pratica as Record<string, unknown>;
    mapped.pratica = mapSqlRow(pr);
    if (pr.debitore && typeof pr.debitore === "object") {
      (mapped.pratica as Record<string, unknown>).debitore = mapSqlRow(pr.debitore as Record<string, unknown>);
    }
  }
  if (row.incasso && typeof row.incasso === "object") {
    mapped.incasso = mapSqlRow(row.incasso as Record<string, unknown>);
  }
  return mapped;
}

export class ConnectorProvvigioniRepository implements ProvvigioniRepository {
  constructor(private tenantSlug: string) {}

  private base(slug?: string) {
    return `/api/v1/tenants/${encodeURIComponent(slug ?? this.tenantSlug)}/provvigioni`;
  }

  async list(req: ProvvigioneListRequest) {
    const data = await connectorFetch<{ items: Record<string, unknown>[]; total: number }>(
      `${this.base(req.tenantSlug)}/list`,
      {
        method: "POST",
        body: {
          filter: req.filter,
          skip: req.skip,
          take: req.take,
          includeOperatore: req.includeOperatore,
          includePraticaDebitore: req.includePraticaDebitore,
          includeIncasso: req.includeIncasso,
        },
      }
    );
    return { items: data.items.map(mapProvvigioneRow), total: data.total };
  }

  async aggregate(req: ProvvigioneAggregateRequest) {
    return connectorFetch<{ _sum: { importo: number | null }; _count: number }>(
      `${this.base(req.tenantSlug)}/aggregate`,
      { method: "POST", body: { filter: req.filter } }
    );
  }

  async groupBy(req: ProvvigioneGroupByRequest) {
    const data = await connectorFetch<{
      items: Array<{ operatoreId?: string; stato?: string; _sum: { importo: number | null }; _count: number }>;
    }>(`${this.base(req.tenantSlug)}/group-by`, {
      method: "POST",
      body: { filter: req.filter, by: req.by },
    });
    return data.items;
  }

  async update(tenantSlug: string, _tenantId: string, id: string, data: ProvvigioneUpdateInput) {
    const res = await connectorFetch<{ item: Record<string, unknown> }>(
      `${this.base(tenantSlug)}/${encodeURIComponent(id)}`,
      { method: "PATCH", body: data }
    );
    return mapProvvigioneRow(res.item);
  }

  async updateMany(tenantSlug: string, _tenantId: string, filter: ProvvigioneListRequest["filter"], data: ProvvigioneUpdateInput) {
    return connectorFetch<{ count: number }>(`${this.base(tenantSlug)}/update-many`, {
      method: "POST",
      body: { filter, data },
    });
  }

  async deleteMany(tenantSlug: string, _tenantId: string, filter: ProvvigioneListRequest["filter"]) {
    return connectorFetch<{ count: number }>(`${this.base(tenantSlug)}/delete-many`, {
      method: "POST",
      body: { filter },
    });
  }
}

export function createConnectorProvvigioniRepository(tenantSlug: string) {
  return new ConnectorProvvigioniRepository(tenantSlug);
}
