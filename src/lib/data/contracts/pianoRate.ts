export type PianoRataCreateInput = {
  praticaId: string;
  numeroRata: number;
  importo: number;
  scadenza: string | Date;
  pagata?: boolean;
};

export type PianoRataFilter = {
  praticaId?: string;
  tenantId?: string;
};

export interface PianoRateRepository {
  create(tenantSlug: string, tenantId: string, data: PianoRataCreateInput): Promise<Record<string, unknown>>;
  createMany(tenantSlug: string, tenantId: string, items: PianoRataCreateInput[]): Promise<{ count: number }>;
  deleteMany(tenantSlug: string, tenantId: string, filter: PianoRataFilter): Promise<{ count: number }>;
}
