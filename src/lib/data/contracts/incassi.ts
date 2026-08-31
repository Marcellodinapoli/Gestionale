export type IncassoFilter = {
  tenantId?: string;
  praticaId?: string;
  praticaIdsIn?: string[];
  userId?: string;
  mandanteId?: string;
  numeroMandante?: string;
  sedeId?: string;
  dataGte?: string;
  dataLte?: string;
  metodo?: string;
  /** Se true, filtro impossibile (nessun dato) */
  none?: boolean;
};

export type IncassoListRequest = {
  tenantSlug: string;
  tenantId: string;
  filter?: IncassoFilter;
  skip?: number;
  take?: number;
  includePratica?: boolean;
};

export type IncassoDto = Record<string, unknown>;

export type IncassoCreateInput = {
  praticaId: string;
  userId: string;
  importo: number;
  capitale?: number;
  interessi?: number;
  spese?: number;
  speseRec?: number;
  metodo?: string;
  modo?: string;
  causale?: string;
  data?: string | Date;
  dataScadenza?: string | Date | null;
};

export type ProvvigioneCreateInput = {
  incassoId: string;
  praticaId: string;
  operatoreId: string;
  baseImporto: number;
  percentuale: number;
  importo: number;
};

export type RegistraIncassoInput = {
  incasso: IncassoCreateInput;
  provvigione?: Omit<ProvvigioneCreateInput, "incassoId"> | null;
  praticaUpdate: { residuo: number; stato: string };
};

export type IncassoAggregateRequest = {
  tenantSlug: string;
  tenantId: string;
  filter?: IncassoFilter;
  sumFields?: ("importo" | "capitale" | "interessi" | "spese")[];
};

export type IncassoGroupByMetodoRequest = {
  tenantSlug: string;
  tenantId: string;
  filter?: IncassoFilter;
};

export interface IncassiRepository {
  list(req: IncassoListRequest): Promise<{ items: IncassoDto[]; total: number }>;
  count(tenantSlug: string, tenantId: string, filter?: IncassoFilter): Promise<number>;
  aggregate(req: IncassoAggregateRequest): Promise<{ _sum: Record<string, number | null> }>;
  groupByMetodo(
    req: IncassoGroupByMetodoRequest
  ): Promise<Array<{ metodo: string; _sum: { importo: number | null }; _count: number }>>;
  getById(tenantSlug: string, tenantId: string, id: string): Promise<IncassoDto | null>;
  create(tenantSlug: string, tenantId: string, data: IncassoCreateInput): Promise<IncassoDto>;
  registra(
    tenantSlug: string,
    tenantId: string,
    input: RegistraIncassoInput
  ): Promise<IncassoDto>;
}
