export type RegistrazioneFilter = {
  tenantId?: string;
  none?: boolean;
  id?: string;
  praticaId?: string;
  praticaIdsIn?: string[];
  operatoreId?: string;
  operatoreIdIn?: string[];
  evidenzaBackOffice?: boolean;
  createdAtGte?: string;
  createdAtLte?: string;
  search?: string;
  praticaScopeMode?: "tenant" | "scope";
};

export type RegistrazioneListRequest = {
  tenantSlug: string;
  tenantId: string;
  filter?: RegistrazioneFilter;
  skip?: number;
  take?: number;
  orderBy?: { createdAt?: "asc" | "desc" };
  includeOperatore?: boolean;
  includePraticaDebitore?: boolean;
};

export type RegistrazioneDto = Record<string, unknown>;

export type RegistrazioneCreateInput = {
  praticaId: string;
  operatoreId: string;
  numero: string;
  direzione?: string;
  stato?: string;
  esito?: string | null;
  durataSec?: number;
  fileName?: string;
  evidenzaBackOffice?: boolean;
};

export interface RegistrazioniRepository {
  list(req: RegistrazioneListRequest): Promise<{ items: RegistrazioneDto[]; total: number }>;
  findFirst(
    tenantSlug: string,
    tenantId: string,
    filter: RegistrazioneFilter
  ): Promise<RegistrazioneDto | null>;
  create(tenantSlug: string, tenantId: string, data: RegistrazioneCreateInput): Promise<RegistrazioneDto>;
  deleteMany(tenantSlug: string, tenantId: string, filter: RegistrazioneFilter): Promise<{ count: number }>;
}
