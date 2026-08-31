export type SedeFilter = {
  tenantId?: string;
  id?: string;
  idsIn?: string[];
  nome?: string;
  active?: boolean;
  excludeId?: string;
};

export type SedeDto = {
  id: string;
  tenantId: string;
  nome: string;
  indirizzo: string | null;
  citta: string | null;
  cap: string | null;
  provincia: string | null;
  telefono: string | null;
  email: string | null;
  note: string | null;
  active: boolean;
  createdAt: string | Date;
};

export type SedeCreateInput = {
  tenantId: string;
  nome: string;
  indirizzo?: string | null;
  citta?: string | null;
  cap?: string | null;
  provincia?: string | null;
  telefono?: string | null;
  email?: string | null;
  note?: string | null;
  active?: boolean;
};

export type SedeUpdateInput = Partial<Omit<SedeCreateInput, "tenantId">>;

export interface SediRepository {
  list(
    tenantSlug: string,
    tenantId: string,
    filter?: SedeFilter & {
      orderBy?: "nome" | "createdAt";
      orderDir?: "asc" | "desc";
      take?: number;
      includeCounts?: boolean;
    }
  ): Promise<SedeDto[]>;
  count(tenantSlug: string, tenantId: string, filter?: SedeFilter): Promise<number>;
  getById(tenantSlug: string, tenantId: string, id: string): Promise<SedeDto | null>;
  findByNome(
    tenantSlug: string,
    tenantId: string,
    nome: string,
    excludeId?: string
  ): Promise<SedeDto | null>;
  create(tenantSlug: string, data: SedeCreateInput): Promise<SedeDto>;
  update(tenantSlug: string, tenantId: string, id: string, data: SedeUpdateInput): Promise<SedeDto>;
}
