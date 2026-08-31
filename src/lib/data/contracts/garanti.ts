export type GaranteFilter = {
  tenantId?: string;
  id?: string;
  praticaId?: string;
  codiceFiscaleIn?: string[];
};

export type GaranteDto = Record<string, unknown>;

export type GaranteUpdateInput = {
  telefono?: string | null;
  email?: string | null;
  telefonoStato?: string | null;
};

export type GaranteRecapitoCreateInput = {
  garanteId: string;
  tipo: string;
  valore: string;
  ordine?: number;
  stato?: string | null;
};

export interface GarantiRepository {
  findFirst(filter: GaranteFilter): Promise<GaranteDto | null>;
  findManyByCf(tenantSlug: string, tenantId: string, variants: string[]): Promise<GaranteDto[]>;
  update(tenantSlug: string, tenantId: string, id: string, data: GaranteUpdateInput): Promise<GaranteDto>;
  deleteManyByPratica(tenantSlug: string, tenantId: string, praticaId: string): Promise<void>;
  countRecapiti(garanteId: string, tipo?: string): Promise<number>;
  findFirstRecapito(filter: { id?: string; garanteId?: string; tipo?: string }): Promise<GaranteDto | null>;
  createRecapito(data: GaranteRecapitoCreateInput): Promise<GaranteDto>;
  updateRecapito(id: string, data: Record<string, unknown>): Promise<GaranteDto>;
  deleteRecapito(id: string): Promise<void>;
  deleteRecapitiByGarante(garanteId: string): Promise<void>;
}
