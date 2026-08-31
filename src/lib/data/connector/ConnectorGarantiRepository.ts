import "server-only";
import { connectorFetch } from "./ConnectorClient";
import { mapSqlRow } from "../mapSqlRow";
import type {
  GaranteFilter,
  GaranteRecapitoCreateInput,
  GaranteUpdateInput,
  GarantiRepository,
} from "../contracts/garanti";

export class ConnectorGarantiRepository implements GarantiRepository {
  constructor(private tenantSlug: string) {}

  private base(slug?: string) {
    return `/api/v1/tenants/${encodeURIComponent(slug ?? this.tenantSlug)}/garanti`;
  }

  async findFirst(filter: GaranteFilter) {
    const data = await connectorFetch<{ item: Record<string, unknown> | null }>(
      `${this.base()}/find-first`,
      { method: "POST", body: { filter } }
    );
    return data.item ? mapSqlRow(data.item) : null;
  }

  async findManyByCf(tenantSlug: string, _tenantId: string, variants: string[]) {
    const data = await connectorFetch<{ items: Record<string, unknown>[] }>(
      `${this.base(tenantSlug)}/ids-by-cf`,
      { method: "POST", body: { variants } }
    );
    return data.items.map(mapSqlRow);
  }

  async update(tenantSlug: string, _tenantId: string, id: string, data: GaranteUpdateInput) {
    const res = await connectorFetch<{ item: Record<string, unknown> }>(
      `${this.base(tenantSlug)}/${encodeURIComponent(id)}`,
      { method: "PATCH", body: data }
    );
    return mapSqlRow(res.item);
  }

  async deleteManyByPratica(tenantSlug: string, _tenantId: string, praticaId: string) {
    await connectorFetch(`${this.base(tenantSlug)}/delete-by-pratica`, {
      method: "POST",
      body: { praticaId },
    });
  }

  async countRecapiti(garanteId: string, tipo?: string) {
    const data = await connectorFetch<{ total: number }>(`${this.base()}/recapiti/count`, {
      method: "POST",
      body: { garanteId, tipo },
    });
    return data.total;
  }

  async findFirstRecapito(filter: { id?: string; garanteId?: string; tipo?: string }) {
    const data = await connectorFetch<{ item: Record<string, unknown> | null }>(
      `${this.base()}/recapiti/find-first`,
      { method: "POST", body: filter }
    );
    return data.item ? mapSqlRow(data.item) : null;
  }

  async createRecapito(data: GaranteRecapitoCreateInput) {
    const res = await connectorFetch<{ item: Record<string, unknown> }>(
      `${this.base()}/${encodeURIComponent(data.garanteId)}/recapiti`,
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

  async deleteRecapitiByGarante(garanteId: string) {
    await connectorFetch(`${this.base()}/${encodeURIComponent(garanteId)}/recapiti`, { method: "DELETE" });
  }
}

export function createConnectorGarantiRepository(tenantSlug: string) {
  return new ConnectorGarantiRepository(tenantSlug);
}
