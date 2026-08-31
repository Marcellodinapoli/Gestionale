import "server-only";
import { connectorFetch } from "./ConnectorClient";
import type {
  ImportBatchCreateInput,
  ImportBatchDto,
  ImportBatchRepository,
  ImportBatchUpdateInput,
  ImportChunkResult,
  ImportPraticaCreateItem,
  ImportPraticaUpdateItem,
} from "../contracts/importBatch";

export class ConnectorImportBatchRepository implements ImportBatchRepository {
  constructor(private tenantSlug: string) {}

  private base(slug?: string) {
    return `/api/v1/tenants/${encodeURIComponent(slug ?? this.tenantSlug)}/import-batch`;
  }

  async findByLotKey(
    tenantSlug: string,
    _tenantId: string,
    input: { mandanteId: string; perimetro: string; lotto: string; tipo?: string }
  ) {
    const data = await connectorFetch<{ item: ImportBatchDto | null }>(
      `${this.base(tenantSlug)}/find-by-lot`,
      { method: "POST", body: input }
    );
    return data.item;
  }

  async getById(tenantSlug: string, _tenantId: string, id: string) {
    const data = await connectorFetch<{ item: ImportBatchDto | null }>(`${this.base(tenantSlug)}/${id}`);
    return data.item;
  }

  async list(tenantSlug: string, _tenantId: string, filter?: { tipo?: string; take?: number }) {
    const data = await connectorFetch<{ items: ImportBatchDto[] }>(`${this.base(tenantSlug)}/list`, {
      method: "POST",
      body: filter,
    });
    return data.items;
  }

  async create(tenantSlug: string, _tenantId: string, data: ImportBatchCreateInput) {
    const res = await connectorFetch<{ item: ImportBatchDto }>(`${this.base(tenantSlug)}/`, {
      method: "POST",
      body: data,
    });
    return res.item;
  }

  async update(tenantSlug: string, _tenantId: string, id: string, data: ImportBatchUpdateInput) {
    const res = await connectorFetch<{ item: ImportBatchDto | null }>(`${this.base(tenantSlug)}/${id}`, {
      method: "PATCH",
      body: data,
    });
    return res.item!;
  }

  async delete(tenantSlug: string, _tenantId: string, id: string) {
    await connectorFetch(`${this.base(tenantSlug)}/${id}`, { method: "DELETE" });
  }

  async processImportChunk(
    tenantSlug: string,
    _tenantId: string,
    input: { creates: ImportPraticaCreateItem[]; updates: ImportPraticaUpdateItem[] }
  ): Promise<ImportChunkResult> {
    return connectorFetch<ImportChunkResult>(`${this.base(tenantSlug)}/process-chunk`, {
      method: "POST",
      body: input,
    });
  }

  async linkPraticheToBatch(
    tenantSlug: string,
    tenantId: string,
    input: { batchId: string; mandanteId: string; lotto: string; affidoIl: string }
  ) {
    return connectorFetch<{ totale: number }>(
      `${this.base(tenantSlug)}/${encodeURIComponent(input.batchId)}/link-pratiche`,
      { method: "POST", body: input }
    );
  }

  async deletePraticaForImport(tenantSlug: string, _tenantId: string, praticaId: string) {
    await connectorFetch(`${this.base(tenantSlug)}/pratica/${encodeURIComponent(praticaId)}`, {
      method: "DELETE",
    });
  }
}

export function createConnectorImportBatchRepository(tenantSlug: string) {
  return new ConnectorImportBatchRepository(tenantSlug);
}
