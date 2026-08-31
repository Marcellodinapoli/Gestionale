export type AttivitaFilter = {
  tenantId?: string;
  praticaId?: string;
  praticaIdsIn?: string[];
  userId?: string;
  userRoleIn?: string[];
  tipo?: string;
  fissata?: boolean;
  createdAtGte?: string;
  createdAtLte?: string;
  none?: boolean;
};

export type AttivitaListRequest = {
  tenantSlug: string;
  tenantId: string;
  filter?: AttivitaFilter;
  skip?: number;
  take?: number;
  orderBy?: { createdAt?: "asc" | "desc" };
  includeUser?: boolean;
};

export type AttivitaDto = Record<string, unknown>;

export type AttivitaCreateInput = {
  praticaId: string;
  userId: string;
  tipo: string;
  esito?: string | null;
  nota?: string | null;
  scheduledAt?: string | Date | null;
  fissata?: boolean;
  importante?: boolean;
  bloccata?: boolean;
};

export type AttivitaUpdateInput = Partial<
  Pick<AttivitaCreateInput, "nota" | "fissata" | "importante" | "bloccata" | "esito" | "tipo">
>;

export interface AttivitaRepository {
  list(req: AttivitaListRequest): Promise<{ items: AttivitaDto[]; total: number }>;
  count(tenantSlug: string, tenantId: string, filter?: AttivitaFilter): Promise<number>;
  groupByUserId(
    tenantSlug: string,
    tenantId: string,
    filter?: AttivitaFilter
  ): Promise<Array<{ userId: string; _count: number }>>;
  getById(tenantSlug: string, tenantId: string, id: string): Promise<AttivitaDto | null>;
  create(tenantSlug: string, tenantId: string, data: AttivitaCreateInput): Promise<AttivitaDto>;
  update(
    tenantSlug: string,
    tenantId: string,
    id: string,
    data: AttivitaUpdateInput
  ): Promise<AttivitaDto>;
  updateMany(
    tenantSlug: string,
    tenantId: string,
    filter: AttivitaFilter,
    data: AttivitaUpdateInput
  ): Promise<{ count: number }>;
  deleteMany(tenantSlug: string, tenantId: string, filter: AttivitaFilter): Promise<{ count: number }>;
  toggleFissa(
    tenantSlug: string,
    tenantId: string,
    attivitaId: string,
    praticaId: string,
    fissata: boolean
  ): Promise<void>;
}
