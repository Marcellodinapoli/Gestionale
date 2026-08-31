export type DocumentoCreateInput = {
  praticaId: string;
  nome: string;
  tipo?: string;
  path?: string | null;
};

export type DocumentoFilter = {
  praticaId?: string;
  tenantId?: string;
};

export interface DocumentiRepository {
  create(tenantSlug: string, tenantId: string, data: DocumentoCreateInput): Promise<Record<string, unknown>>;
  deleteMany(tenantSlug: string, tenantId: string, filter: DocumentoFilter): Promise<{ count: number }>;
}
