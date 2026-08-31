import "server-only";
import { connectorFetch } from "./ConnectorClient";
import { mapSqlRow } from "../mapSqlRow";
import type {
  RegistrazioneCreateInput,
  RegistrazioneFilter,
  RegistrazioneListRequest,
  RegistrazioniRepository,
} from "../contracts/registrazioni";

function mapRegistrazioneRow(row: Record<string, unknown>) {
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
  return mapped;
}

export class ConnectorRegistrazioniRepository implements RegistrazioniRepository {
  constructor(private tenantSlug: string) {}

  private base(slug?: string) {
    return `/api/v1/tenants/${encodeURIComponent(slug ?? this.tenantSlug)}/registrazioni`;
  }

  async list(req: RegistrazioneListRequest) {
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
        },
      }
    );
    return { items: data.items.map(mapRegistrazioneRow), total: data.total };
  }

  async findFirst(tenantSlug: string, _tenantId: string, filter: RegistrazioneFilter) {
    const data = await connectorFetch<{ item: Record<string, unknown> | null }>(
      `${this.base(tenantSlug)}/find-first`,
      { method: "POST", body: { filter } }
    );
    return data.item ? mapRegistrazioneRow(data.item) : null;
  }

  async create(tenantSlug: string, _tenantId: string, body: RegistrazioneCreateInput) {
    const res = await connectorFetch<{ item: Record<string, unknown> }>(`${this.base(tenantSlug)}/`, {
      method: "POST",
      body,
    });
    return mapRegistrazioneRow(res.item);
  }

  async deleteMany(tenantSlug: string, _tenantId: string, filter: RegistrazioneFilter) {
    return connectorFetch<{ count: number }>(`${this.base(tenantSlug)}/delete-many`, {
      method: "POST",
      body: { filter },
    });
  }
}

export function createConnectorRegistrazioniRepository(tenantSlug: string) {
  return new ConnectorRegistrazioniRepository(tenantSlug);
}
