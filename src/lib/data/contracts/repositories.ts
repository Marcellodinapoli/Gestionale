export type TenantRecord = {
  id: string;
  slug: string;
  nome: string;
  active: boolean;
};

export type UserRecord = {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  passwordHash?: string;
  role: string;
  active: boolean;
  acronimo?: string | null;
  formazioneOnly?: boolean;
  interno?: string | null;
  prefissoChiamata?: string | null;
  supervisorId?: string | null;
  gruppoNome?: string | null;
  gruppoMandantiJson?: string | null;
  postazioneId?: string | null;
  postazioneFissa?: boolean;
  sedeId?: string | null;
  passwordChangedAt?: Date | string | null;
  lastLoginAt?: Date | string | null;
};

export type UserSessionRecord = UserRecord & {
  tenantSlug: string;
  tenantNome: string;
  tenantActive: boolean;
  postazioneInterno?: string | null;
  postazioneEmail?: string | null;
  postazioneNome?: string | null;
  sedeNome?: string | null;
};

export type PostazioneRecord = {
  id: string;
  tenantId: string;
  nome: string;
  sedeId?: string | null;
  active: boolean;
};

export type PraticaRecord = {
  id: string;
  tenantId: string;
  numero: string;
  stato: string;
  capitale: number;
  interessi: number;
  spese: number;
  importoTotale: number;
  totIncassato: number;
  residuo: number;
  mandanteId: string;
  debitoreId: string;
  assegnatarioId?: string | null;
  memoAt?: string | null;
  updatedAt: string;
  debitoreNome?: string;
  debitoreCognome?: string;
  mandanteCodice?: string;
};

export type PraticaSearchParams = {
  stato?: string;
  mandanteId?: string;
  assegnatarioId?: string;
  q?: string;
  page?: number;
  pageSize?: number;
};

export type PraticaSearchResult = {
  items: PraticaRecord[];
  total: number;
  page: number;
  pageSize: number;
  queryMs?: number;
};

export type DashboardHomeSummary = {
  praticheTotali: number;
  praticheNuove: number;
  praticheInLavoro: number;
  praticheScadute: number;
  incassiOggi: number;
  operatoriAttivi: number;
  mandanti: number;
};

export type DashboardHomeResult = {
  summary: DashboardHomeSummary;
  kpi: Array<{
    scopeType: string;
    scopeId: string;
    kpiKey: string;
    valoreNumeric: number | null;
    valoreJson: string | null;
    updatedAt: string;
  }>;
  queryMs?: number;
};

export interface TenantsRepository {
  getBySlug(slug: string): Promise<TenantRecord | null>;
  getById(id: string): Promise<TenantRecord | null>;
}

export interface UsersRepository {
  findByEmail(tenantId: string, email: string): Promise<UserRecord | null>;
  findById(tenantId: string, id: string): Promise<UserRecord | null>;
  getSession(tenantId: string, id: string): Promise<UserSessionRecord | null>;
  getAuditContext(userId: string): Promise<{ tenantId: string; tenantSlug: string } | null>;
  updateLogin(
    userId: string,
    data: {
      lastLoginAt: Date;
      postazioneId?: string | null;
      postazioneFissa?: boolean;
    }
  ): Promise<void>;
  listByTenant(tenantId: string): Promise<UserRecord[]>;
}

export interface PostazioniRepository {
  findActive(tenantId: string, id: string): Promise<PostazioneRecord | null>;
}

export interface PraticheRepository {
  getById(tenantId: string, id: string): Promise<PraticaRecord | null>;
  search(tenantId: string, params: PraticaSearchParams): Promise<PraticaSearchResult>;
}

export type { DashboardRepository } from "./dashboard";

export interface DataRepositories {
  tenants: TenantsRepository;
  users: UsersRepository;
  postazioni: PostazioniRepository;
  pratiche: PraticheRepository;
  dashboard: import("./dashboard").DashboardRepository;
}
