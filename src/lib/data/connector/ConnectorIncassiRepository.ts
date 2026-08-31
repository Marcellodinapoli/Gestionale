import "server-only";
import { connectorFetch } from "./ConnectorClient";
import { mapSqlRow } from "../mapSqlRow";
import type {
  IncassoAggregateRequest,
  IncassoCreateInput,
  IncassoGroupByMetodoRequest,
  IncassoListRequest,
  IncassiRepository,
  RegistraIncassoInput,
} from "../contracts/incassi";

function mapIncassoRow(row: Record<string, unknown>) {
  const mapped = mapSqlRow(row);
  if (row.pratica && typeof row.pratica === "object") {
    mapped.pratica = mapSqlRow(row.pratica as Record<string, unknown>);
  }
  if (row.user && typeof row.user === "object") {
    mapped.user = mapSqlRow(row.user as Record<string, unknown>);
  }
  return mapped;
}

export class ConnectorIncassiRepository implements IncassiRepository {
  constructor(private tenantSlug: string) {}

  private base(slug?: string) {
    return `/api/v1/tenants/${encodeURIComponent(slug ?? this.tenantSlug)}/incassi`;
  }

  async list(req: IncassoListRequest) {
    const data = await connectorFetch<{ items: Record<string, unknown>[]; total: number }>(
      `${this.base(req.tenantSlug)}/list`,
      {
        method: "POST",
        body: {
          filter: req.filter,
          skip: req.skip,
          take: req.take,
          includePratica: req.includePratica,
        },
      }
    );
    return { items: data.items.map(mapIncassoRow), total: data.total };
  }

  async count(tenantSlug: string, _tenantId: string, filter?: IncassoListRequest["filter"]) {
    const data = await connectorFetch<{ total: number }>(`${this.base(tenantSlug)}/count`, {
      method: "POST",
      body: { filter },
    });
    return data.total;
  }

  async aggregate(req: IncassoAggregateRequest) {
    return connectorFetch<{ _sum: Record<string, number | null> }>(
      `${this.base(req.tenantSlug)}/aggregate`,
      { method: "POST", body: { filter: req.filter } }
    );
  }

  async groupByMetodo(req: IncassoGroupByMetodoRequest) {
    const data = await connectorFetch<{
      items: Array<{ metodo: string; _sum: { importo: number | null }; _count: number }>;
    }>(`${this.base(req.tenantSlug)}/group-by-metodo`, {
      method: "POST",
      body: { filter: req.filter },
    });
    return data.items;
  }

  async getById(tenantSlug: string, _tenantId: string, id: string) {
    const data = await connectorFetch<{ item: Record<string, unknown> | null }>(
      `${this.base(tenantSlug)}/${encodeURIComponent(id)}`
    );
    return data.item ? mapIncassoRow(data.item) : null;
  }

  async create(tenantSlug: string, _tenantId: string, body: IncassoCreateInput) {
    const res = await connectorFetch<{ item: Record<string, unknown> }>(
      `${this.base(tenantSlug)}/registra`,
      {
        method: "POST",
        body: {
          incasso: body,
          praticaUpdate: { residuo: 0, stato: "AFFIDATA" },
        },
      }
    );
    return mapIncassoRow(res.item);
  }

  async registra(tenantSlug: string, _tenantId: string, input: RegistraIncassoInput) {
    const res = await connectorFetch<{ item: Record<string, unknown> }>(
      `${this.base(tenantSlug)}/registra`,
      { method: "POST", body: input }
    );
    return mapIncassoRow(res.item);
  }
}

export function createConnectorIncassiRepository(tenantSlug: string) {
  return new ConnectorIncassiRepository(tenantSlug);
}
