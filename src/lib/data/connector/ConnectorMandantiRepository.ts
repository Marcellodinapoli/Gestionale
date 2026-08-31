import "server-only";
import { connectorFetch } from "./ConnectorClient";
import { mapSqlRow } from "../mapSqlRow";
import type {
  MandanteCreateInput,
  MandanteFilter,
  MandanteListRequest,
  MandanteUpdateInput,
  MandantiRepository,
} from "../contracts/mandanti";

export class ConnectorMandantiRepository implements MandantiRepository {
  constructor(private tenantSlug: string) {}

  private base(slug?: string) {
    return `/api/v1/tenants/${encodeURIComponent(slug ?? this.tenantSlug)}/mandanti`;
  }

  async list(req: MandanteListRequest) {
    const orderBy = req.orderBy?.codice != null ? "codice" : req.orderBy?.ragioneSociale != null ? "ragioneSociale" : "codice";
    const orderDir = req.orderBy?.codice ?? req.orderBy?.ragioneSociale ?? "asc";
    const data = await connectorFetch<{
      items: Record<string, unknown>[];
      total: number;
    }>(`${this.base(req.tenantSlug)}/list`, {
      method: "POST",
      body: {
        filter: req.filter,
        orderBy,
        orderDir,
        skip: req.skip,
        take: req.take,
        includePraticaCount: req.includePraticaCount,
      },
    });
    return { items: data.items.map(mapSqlRow), total: data.total };
  }

  async count(tenantSlug: string, tenantId: string, filter?: MandanteFilter) {
    const data = await connectorFetch<{ total: number }>(`${this.base(tenantSlug)}/count`, {
      method: "POST",
      body: { filter: { ...filter, tenantId } },
    });
    return data.total;
  }

  async getById(tenantSlug: string, tenantId: string, id: string, includePraticaCount?: boolean) {
    const q = includePraticaCount ? "?includeCount=1" : "";
    const data = await connectorFetch<{ item: Record<string, unknown> | null }>(
      `${this.base(tenantSlug)}/${encodeURIComponent(id)}${q}`
    );
    return data.item ? mapSqlRow(data.item) : null;
  }

  async create(tenantSlug: string, data: MandanteCreateInput) {
    const res = await connectorFetch<{ item: Record<string, unknown> }>(`${this.base(tenantSlug)}/`, {
      method: "POST",
      body: data,
    });
    return mapSqlRow(res.item);
  }

  async update(tenantSlug: string, tenantId: string, id: string, data: MandanteUpdateInput) {
    const res = await connectorFetch<{ item: Record<string, unknown> }>(
      `${this.base(tenantSlug)}/${encodeURIComponent(id)}`,
      { method: "PATCH", body: data }
    );
    return mapSqlRow(res.item);
  }

  async delete(tenantSlug: string, tenantId: string, id: string) {
    await connectorFetch(`${this.base(tenantSlug)}/${encodeURIComponent(id)}`, { method: "DELETE" });
  }
}

export function createConnectorMandantiRepository(tenantSlug: string) {
  return new ConnectorMandantiRepository(tenantSlug);
}
