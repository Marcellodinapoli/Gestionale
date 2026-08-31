export type DebitoreFilter = {
  ids?: string[];
  idsIn?: string[];
  codiceFiscaleIn?: string[];
  tenantId?: string;
  q?: string;
};

export type DebitoreListRequest = {
  tenantSlug: string;
  tenantId: string;
  filter?: DebitoreFilter;
  skip?: number;
  take?: number;
};

export type DebitoreDto = Record<string, unknown>;

export type DebitoreCreateInput = {
  tenantId: string;
  nome: string;
  cognome?: string;
  codiceFiscale?: string | null;
  telefono?: string | null;
  telefonoStato?: string | null;
  email?: string | null;
  indirizzo?: string | null;
  citta?: string | null;
  cap?: string | null;
  provincia?: string | null;
  ndg?: string | null;
};

export type DebitoreUpdateInput = Partial<Omit<DebitoreCreateInput, "tenantId">>;

export type RecapitoCreateInput = {
  debitoreId: string;
  tipo: string;
  valore: string;
  ordine?: number;
  stato?: string | null;
};

export interface DebitoriRepository {
  list(req: DebitoreListRequest): Promise<{ items: DebitoreDto[]; total: number }>;
  idsByCf(tenantSlug: string, tenantId: string, variants: string[]): Promise<DebitoreDto[]>;
  getById(tenantSlug: string, tenantId: string, id: string): Promise<DebitoreDto | null>;
  create(tenantSlug: string, data: DebitoreCreateInput): Promise<DebitoreDto>;
  update(
    tenantSlug: string,
    tenantId: string,
    id: string,
    data: DebitoreUpdateInput
  ): Promise<DebitoreDto>;
  delete(tenantSlug: string, tenantId: string, id: string): Promise<void>;
  countRecapiti(debitoreId: string, tipo?: string): Promise<number>;
  findFirstRecapito(filter: {
    id?: string;
    debitoreId?: string;
    tipo?: string;
  }): Promise<DebitoreDto | null>;
  createRecapito(data: RecapitoCreateInput): Promise<DebitoreDto>;
  updateRecapito(id: string, data: Record<string, unknown>): Promise<DebitoreDto>;
  deleteRecapito(id: string): Promise<void>;
  deleteRecapitiByDebitore(debitoreId: string): Promise<void>;
}
