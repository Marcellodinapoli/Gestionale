import "server-only";
import { connectorFetch } from "./ConnectorClient";
import { mapSqlRow } from "../mapSqlRow";
import type {
  SedeCreateInput,
  SedeFilter,
  SedeUpdateInput,
  SediRepository,
} from "../contracts/sedi";

export class ConnectorSediRepository implements SediRepository {
  constructor(private tenantSlug: string) {}

  private base(slug?: string) {
    return `/api/v1/tenants/${encodeURIComponent(slug ?? this.tenantSlug)}/sedi`;
  }

  async list(
    tenantSlug: string,
    tenantId: string,
    filter?: SedeFilter & {
      orderBy?: "nome" | "createdAt";
      orderDir?: "asc" | "desc";
      take?: number;
      includeCounts?: boolean;
    }
  ) {
    const data = await connectorFetch<{ items: Record<string, unknown>[] }>(
      `${this.base(tenantSlug)}/list`,
      {
        method: "POST",
        body: {
          filter: { ...filter, tenantId },
          orderBy: filter?.orderBy,
          orderDir: filter?.orderDir,
          take: filter?.take,
          includeCounts: filter?.includeCounts,
        },
      }
    );
    return data.items.map(mapSqlRow) as import("../contracts/sedi").SedeDto[];
  }

  async count(tenantSlug: string, tenantId: string, filter?: SedeFilter) {
    const data = await connectorFetch<{ total: number }>(`${this.base(tenantSlug)}/count`, {
      method: "POST",
      body: { filter: { ...filter, tenantId } },
    });
    return data.total;
  }

  async getById(tenantSlug: string, tenantId: string, id: string) {
    const data = await connectorFetch<{ item: Record<string, unknown> | null }>(
      `${this.base(tenantSlug)}/${encodeURIComponent(id)}`
    );
    return data.item ? (mapSqlRow(data.item) as import("../contracts/sedi").SedeDto) : null;
  }

  async findByNome(tenantSlug: string, tenantId: string, nome: string, excludeId?: string) {
    const items = await this.list(tenantSlug, tenantId, { nome, excludeId, take: 1 });
    return items[0] ?? null;
  }

  async create(tenantSlug: string, data: SedeCreateInput) {
    const res = await connectorFetch<{ item: Record<string, unknown> }>(`${this.base(tenantSlug)}/`, {
      method: "POST",
      body: data,
    });
    return mapSqlRow(res.item) as import("../contracts/sedi").SedeDto;
  }

  async update(tenantSlug: string, tenantId: string, id: string, data: SedeUpdateInput) {
    const res = await connectorFetch<{ item: Record<string, unknown> }>(
      `${this.base(tenantSlug)}/${encodeURIComponent(id)}`,
      { method: "PATCH", body: data }
    );
    return mapSqlRow(res.item) as import("../contracts/sedi").SedeDto;
  }
}

export function createConnectorSediRepository(tenantSlug: string) {
  return new ConnectorSediRepository(tenantSlug);
}
