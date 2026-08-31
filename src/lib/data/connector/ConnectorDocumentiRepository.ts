import "server-only";
import { connectorFetch } from "./ConnectorClient";
import { mapSqlRow } from "../mapSqlRow";
import type {
  DocumentoCreateInput,
  DocumentoFilter,
  DocumentiRepository,
} from "../contracts/documenti";

export class ConnectorDocumentiRepository implements DocumentiRepository {
  constructor(private tenantSlug: string) {}

  private base(slug?: string) {
    return `/api/v1/tenants/${encodeURIComponent(slug ?? this.tenantSlug)}/documenti`;
  }

  async create(tenantSlug: string, _tenantId: string, data: DocumentoCreateInput) {
    const res = await connectorFetch<{ item: Record<string, unknown> }>(`${this.base(tenantSlug)}/`, {
      method: "POST",
      body: data,
    });
    return mapSqlRow(res.item);
  }

  async deleteMany(tenantSlug: string, _tenantId: string, filter: DocumentoFilter) {
    return connectorFetch<{ count: number }>(`${this.base(tenantSlug)}/delete-many`, {
      method: "POST",
      body: { praticaId: filter.praticaId },
    });
  }
}

export function createConnectorDocumentiRepository(tenantSlug: string) {
  return new ConnectorDocumentiRepository(tenantSlug);
}
