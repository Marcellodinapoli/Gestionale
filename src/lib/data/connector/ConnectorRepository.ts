import { connectorFetch } from "./ConnectorClient";
import { createConnectorDashboardRepository } from "./ConnectorDashboardRepository";

import type {

  DashboardHomeResult,

  DashboardRepository,

  DataRepositories,

  PostazioneRecord,

  PostazioniRepository,

  PraticaRecord,

  PraticaSearchParams,

  PraticaSearchResult,

  PraticheRepository,

  TenantRecord,

  TenantsRepository,

  UserRecord,

  UserSessionRecord,

  UsersRepository,

} from "../contracts/repositories";



function mapPratica(row: Record<string, unknown>): PraticaRecord {

  return {

    id: String(row.Id ?? row.id),

    tenantId: String(row.TenantId ?? row.tenantId),

    numero: String(row.Numero ?? row.numero),

    stato: String(row.Stato ?? row.stato),

    capitale: Number(row.Capitale ?? row.capitale),

    interessi: Number(row.Interessi ?? row.interessi),

    spese: Number(row.Spese ?? row.spese),

    importoTotale: Number(row.ImportoTotale ?? row.importoTotale),

    totIncassato: Number(row.TotIncassato ?? row.totIncassato ?? 0),

    residuo: Number(row.Residuo ?? row.residuo),

    mandanteId: String(row.MandanteId ?? row.mandanteId),

    debitoreId: String(row.DebitoreId ?? row.debitoreId),

    assegnatarioId: row.AssegnatarioId != null ? String(row.AssegnatarioId) : null,

    memoAt: row.MemoAt ? String(row.MemoAt) : null,

    updatedAt: String(row.UpdatedAt ?? row.updatedAt),

    debitoreNome: row.DebitoreNome ? String(row.DebitoreNome) : undefined,

    debitoreCognome: row.DebitoreCognome ? String(row.DebitoreCognome) : undefined,

    mandanteCodice: row.MandanteCodice ? String(row.MandanteCodice) : undefined,

  };

}



function mapUser(row: Record<string, unknown>): UserRecord {

  return {

    id: String(row.Id ?? row.id),

    tenantId: String(row.TenantId ?? row.tenantId),

    email: String(row.Email ?? row.email),

    name: String(row.Name ?? row.name),

    passwordHash: row.PasswordHash != null ? String(row.PasswordHash) : undefined,

    role: String(row.Role ?? row.role),

    active: Boolean(row.Active ?? row.active ?? true),

    acronimo: row.Acronimo != null ? String(row.Acronimo) : null,

    formazioneOnly: Boolean(row.FormazioneOnly ?? row.formazioneOnly ?? false),

    interno: row.Interno != null ? String(row.Interno) : null,

    prefissoChiamata: row.PrefissoChiamata != null ? String(row.PrefissoChiamata) : null,

    supervisorId: row.SupervisorId != null ? String(row.SupervisorId) : null,

    gruppoNome: row.GruppoNome != null ? String(row.GruppoNome) : null,

    gruppoMandantiJson: row.GruppoMandantiJson != null ? String(row.GruppoMandantiJson) : null,

    postazioneId: row.PostazioneId != null ? String(row.PostazioneId) : null,

    postazioneFissa: Boolean(row.PostazioneFissa ?? row.postazioneFissa ?? false),

    sedeId: row.SedeId != null ? String(row.SedeId) : null,

    passwordChangedAt: row.PasswordChangedAt ? String(row.PasswordChangedAt) : null,

    lastLoginAt: row.LastLoginAt ? String(row.LastLoginAt) : null,

  };

}



function mapUserSession(row: Record<string, unknown>): UserSessionRecord {

  const base = mapUser(row);

  return {

    ...base,

    tenantSlug: String(row.TenantSlug ?? row.tenantSlug),

    tenantNome: String(row.TenantNome ?? row.tenantNome),

    tenantActive: Boolean(row.TenantActive ?? row.tenantActive ?? true),

    postazioneInterno: row.PostazioneInterno != null ? String(row.PostazioneInterno) : null,

    postazioneEmail: row.PostazioneEmail != null ? String(row.PostazioneEmail) : null,

    postazioneNome: row.PostazioneNome != null ? String(row.PostazioneNome) : null,

    sedeNome: row.SedeNome != null ? String(row.SedeNome) : null,

  };

}



class ConnectorTenantsRepository implements TenantsRepository {

  async getBySlug(slug: string): Promise<TenantRecord | null> {

    const data = await connectorFetch<{ tenant: Record<string, unknown> | null }>(

      `/api/v1/tenants/${encodeURIComponent(slug)}/auth/tenant`

    );

    if (!data.tenant) return null;

    const t = data.tenant;

    return {

      id: String(t.Id ?? t.id),

      slug: String(t.Slug ?? t.slug),

      nome: String(t.Nome ?? t.nome),

      active: Boolean(t.Active ?? t.active ?? true),

    };

  }

  async getById(id: string): Promise<TenantRecord | null> {
    const data = await connectorFetch<{ tenant: Record<string, unknown> | null }>(
      `/api/v1/internal/tenants/${encodeURIComponent(id)}`
    );
    if (!data.tenant) return null;
    const t = data.tenant;
    return {
      id: String(t.Id ?? t.id),
      slug: String(t.Slug ?? t.slug),
      nome: String(t.Nome ?? t.nome),
      active: Boolean(t.Active ?? t.active ?? true),
    };
  }

}



class ConnectorUsersRepository implements UsersRepository {

  async findByEmail(tenantId: string, email: string): Promise<UserRecord | null> {

    const data = await connectorFetch<{ user: Record<string, unknown> | null }>(

      `/api/v1/internal/users/by-email`,

      { method: "POST", body: { tenantId, email } }

    );

    return data.user ? mapUser(data.user) : null;

  }



  async findById(tenantId: string, id: string): Promise<UserRecord | null> {

    const data = await connectorFetch<{ user: Record<string, unknown> | null }>(

      `/api/v1/internal/users/${encodeURIComponent(id)}?tenantId=${encodeURIComponent(tenantId)}`

    );

    return data.user ? mapUser(data.user) : null;

  }



  async getSession(tenantId: string, id: string): Promise<UserSessionRecord | null> {

    const data = await connectorFetch<{ user: Record<string, unknown> | null }>(

      `/api/v1/internal/users/${encodeURIComponent(id)}/session?tenantId=${encodeURIComponent(tenantId)}`

    );

    return data.user ? mapUserSession(data.user) : null;

  }



  async updateLogin(userId: string, data: {

    lastLoginAt: Date;

    postazioneId?: string | null;

    postazioneFissa?: boolean;

  }): Promise<void> {

    await connectorFetch(`/api/v1/internal/users/${encodeURIComponent(userId)}/login`, {

      method: "PATCH",

      body: {

        lastLoginAt: data.lastLoginAt.toISOString(),

        postazioneId: data.postazioneId ?? null,

        postazioneFissa: data.postazioneFissa,

      },

    });

  }



  async getAuditContext(userId: string) {
    const data = await connectorFetch<{
      context: { TenantId?: string; tenantId?: string; TenantSlug?: string; tenantSlug?: string } | null;
    }>(`/api/v1/internal/users/${encodeURIComponent(userId)}/audit-context`);
    if (!data.context) return null;
    const c = data.context;
    const tenantId = String(c.TenantId ?? c.tenantId ?? "");
    const tenantSlug = String(c.TenantSlug ?? c.tenantSlug ?? "");
    if (!tenantId || !tenantSlug) return null;
    return { tenantId, tenantSlug };
  }



  async listByTenant(tenantId: string): Promise<UserRecord[]> {
    const tenant = await this.findTenantSlugForId(tenantId);
    if (!tenant) throw new Error("ConnectorUsersRepository.listByTenant — tenant non trovato");
    const list = await connectorFetch<{ items: Record<string, unknown>[] }>(
      `/api/v1/tenants/${encodeURIComponent(tenant)}/users/list`,
      { method: "POST", body: { filter: { tenantId }, take: 500 } }
    );
    return list.items.map(mapUser);
  }

  private async findTenantSlugForId(tenantId: string) {
    const data = await connectorFetch<{ tenant: Record<string, unknown> | null }>(
      `/api/v1/internal/tenants/${encodeURIComponent(tenantId)}`
    );
    const slug = data.tenant?.Slug ?? data.tenant?.slug;
    return slug ? String(slug) : null;
  }

}



class ConnectorPostazioniRepository implements PostazioniRepository {

  async findActive(tenantId: string, id: string): Promise<PostazioneRecord | null> {

    const data = await connectorFetch<{ postazione: Record<string, unknown> | null }>(

      `/api/v1/internal/postazioni/${encodeURIComponent(id)}?tenantId=${encodeURIComponent(tenantId)}`

    );

    if (!data.postazione) return null;

    const p = data.postazione;

    return {

      id: String(p.Id),

      tenantId: String(p.TenantId),

      nome: String(p.Nome),

      sedeId: p.SedeId != null ? String(p.SedeId) : null,

      active: Boolean(p.Active),

    };

  }

}



class ConnectorPraticheRepository implements PraticheRepository {

  async getById(tenantSlug: string, id: string): Promise<PraticaRecord | null> {

    const data = await connectorFetch<{ item: Record<string, unknown> | null }>(

      `/api/v1/tenants/${encodeURIComponent(tenantSlug)}/pratiche/${encodeURIComponent(id)}`

    );

    return data.item ? mapPratica(data.item) : null;

  }



  async search(tenantSlug: string, params: PraticaSearchParams): Promise<PraticaSearchResult> {

    const data = await connectorFetch<{

      items: Record<string, unknown>[];

      total: number;

      page: number;

      pageSize: number;

      queryMs?: number;

    }>(`/api/v1/tenants/${encodeURIComponent(tenantSlug)}/pratiche/search`, {

      method: "POST",

      body: params,

    });

    return {

      items: data.items.map(mapPratica),

      total: data.total,

      page: data.page,

      pageSize: data.pageSize,

      queryMs: data.queryMs,

    };

  }

}



export function createConnectorRepositories(): DataRepositories {
  return {
    tenants: new ConnectorTenantsRepository(),
    users: new ConnectorUsersRepository(),
    postazioni: new ConnectorPostazioniRepository(),
    pratiche: new ConnectorPraticheRepository(),
    dashboard: createConnectorDashboardRepository(),
  };
}

export type ConnectorRepositories = ReturnType<typeof createConnectorRepositories>;


