export type UserFilter = {
  tenantId?: string;
  id?: string;
  idsIn?: string[];
  email?: string;
  active?: boolean;
  role?: string;
  rolesIn?: string[];
  supervisorId?: string | null;
  supervisorIdSet?: boolean;
  formazioneOnly?: boolean;
  sedeId?: string | null;
  sedeIdSet?: boolean;
  postazioneId?: string | null;
  postazioneIdSet?: boolean;
  excludeId?: string;
  excludeRole?: string;
};

export type UserOrderBy = {
  name?: "asc" | "desc";
  email?: "asc" | "desc";
  role?: "asc" | "desc";
  createdAt?: "asc" | "desc";
  lastLoginAt?: "asc" | "desc";
};

export type UserInclude = {
  sede?: boolean;
  postazione?: boolean;
  supervisor?: boolean;
  passwordHistory?: boolean;
};

export type UserListRequest = {
  tenantSlug: string;
  tenantId: string;
  filter?: UserFilter;
  orderBy?: UserOrderBy;
  skip?: number;
  take?: number;
  include?: UserInclude;
  select?: Record<string, unknown>;
};

export type UserDto = Record<string, unknown>;

export type UserCreateInput = {
  tenantId: string;
  name: string;
  cognome?: string | null;
  codiceFiscale?: string | null;
  annoNascita?: number | null;
  residenza?: string | null;
  email: string;
  passwordHash: string;
  passwordChangedAt?: Date | string;
  role: string;
  acronimo?: string | null;
  formazioneOnly?: boolean;
  interno?: string | null;
  prefissoChiamata?: string | null;
  condizioneEconomica?: string | null;
  importoFisso?: number | null;
  active?: boolean;
  supervisorId?: string | null;
  gruppoNome?: string | null;
  gruppoMandanti?: string | null;
  lavorazioneSuggerita?: string | null;
  postazioneId?: string | null;
  postazioneFissa?: boolean;
  sedeId?: string | null;
  lastLoginAt?: Date | string | null;
  lastLogoutAt?: Date | string | null;
};

export type UserUpdateInput = Partial<Omit<UserCreateInput, "tenantId">> & {
  email?: string;
};

export interface UsersOperationalRepository {
  list(req: UserListRequest): Promise<{ items: UserDto[]; total: number }>;
  count(tenantSlug: string, tenantId: string, filter?: UserFilter): Promise<number>;
  getById(
    tenantSlug: string,
    tenantId: string,
    id: string,
    opts?: { include?: UserInclude; select?: Record<string, unknown> }
  ): Promise<UserDto | null>;
  findByEmail(
    tenantSlug: string,
    tenantId: string,
    email: string,
    opts?: { include?: UserInclude; select?: Record<string, unknown> }
  ): Promise<UserDto | null>;
  create(tenantSlug: string, data: UserCreateInput): Promise<UserDto>;
  update(
    tenantSlug: string,
    tenantId: string,
    id: string,
    data: UserUpdateInput
  ): Promise<UserDto>;
  updateMany(
    tenantSlug: string,
    tenantId: string,
    filter: UserFilter,
    data: UserUpdateInput
  ): Promise<{ count: number }>;
}
