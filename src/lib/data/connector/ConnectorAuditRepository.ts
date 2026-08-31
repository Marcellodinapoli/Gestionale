import "server-only";
import { connectorFetch } from "./ConnectorClient";
import type {
  AuditCreateInput,
  AuditLogDto,
  AuditLogFilter,
  AuditRepository,
} from "../contracts/audit";

export class ConnectorAuditRepository implements AuditRepository {
  constructor(private tenantSlug: string) {}

  private base(slug?: string) {
    return `/api/v1/tenants/${encodeURIComponent(slug ?? this.tenantSlug)}/audit`;
  }

  async append(tenantSlug: string, input: AuditCreateInput) {
    await connectorFetch(`${this.base(tenantSlug)}/`, { method: "POST", body: input });
  }

  async list(tenantSlug: string, _tenantId: string, filter?: AuditLogFilter) {
    const data = await connectorFetch<{ items: AuditLogDto[] }>(`${this.base(tenantSlug)}/list`, {
      method: "POST",
      body: { filter },
    });
    return data.items;
  }
}

export function createConnectorAuditRepository(tenantSlug: string) {
  return new ConnectorAuditRepository(tenantSlug);
}
