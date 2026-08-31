export type FatturaCreateInput = {
  praticaId: string;
  numero: string;
  causale?: string;
  importo: number;
  pagato?: number;
  dataFattura: string | Date;
  dataScadenza: string | Date;
};

export type FatturaFilter = {
  praticaId?: string;
  tenantId?: string;
};

export interface FattureRepository {
  create(tenantSlug: string, tenantId: string, data: FatturaCreateInput): Promise<Record<string, unknown>>;
  deleteMany(tenantSlug: string, tenantId: string, filter: FatturaFilter): Promise<{ count: number }>;
}
