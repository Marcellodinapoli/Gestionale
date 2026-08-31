export type ProvvigioneFilter = {
  tenantId?: string;
  none?: boolean;
  id?: string;
  idsIn?: string[];
  praticaId?: string;
  operatoreId?: string;
  operatoreIdIn?: string[];
  operatoreSedeId?: string;
  operatoreOrSupervisorId?: string;
  stato?: string;
  createdAtGte?: string;
  createdAtLte?: string;
  praticaMandanteId?: string;
  praticaNumeroMandante?: string;
  praticaNumeroMandanteNull?: boolean;
  perimetroOr?: Array<{ mandanteId: string; numeriMandante?: string[] }>;
};

export type ProvvigioneListRequest = {
  tenantSlug: string;
  tenantId: string;
  filter?: ProvvigioneFilter;
  skip?: number;
  take?: number;
  orderBy?: { createdAt?: "asc" | "desc" };
  includeOperatore?: boolean;
  includePraticaDebitore?: boolean;
  includeIncasso?: boolean;
};

export type ProvvigioneDto = Record<string, unknown>;

export type ProvvigioneUpdateInput = {
  stato?: string;
  importo?: number;
  percentuale?: number;
  liquidataAt?: string | Date | null;
};

export type ProvvigioneAggregateRequest = {
  tenantSlug: string;
  tenantId: string;
  filter?: ProvvigioneFilter;
};

export type ProvvigioneGroupByRequest = {
  tenantSlug: string;
  tenantId: string;
  filter?: ProvvigioneFilter;
  by: ("operatoreId" | "stato")[];
};

export interface ProvvigioniRepository {
  list(req: ProvvigioneListRequest): Promise<{ items: ProvvigioneDto[]; total: number }>;
  aggregate(req: ProvvigioneAggregateRequest): Promise<{ _sum: { importo: number | null }; _count: number }>;
  groupBy(
    req: ProvvigioneGroupByRequest
  ): Promise<Array<{ operatoreId?: string; stato?: string; _sum: { importo: number | null }; _count: number }>>;
  update(tenantSlug: string, tenantId: string, id: string, data: ProvvigioneUpdateInput): Promise<ProvvigioneDto>;
  updateMany(
    tenantSlug: string,
    tenantId: string,
    filter: ProvvigioneFilter,
    data: ProvvigioneUpdateInput
  ): Promise<{ count: number }>;
  deleteMany(tenantSlug: string, tenantId: string, filter: ProvvigioneFilter): Promise<{ count: number }>;
}
