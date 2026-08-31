export type ImportBatchDto = {
  id: string;
  tenantId: string;
  tipo: string;
  mandanteId: string;
  mandanteCodice: string;
  perimetro: string;
  lotto: string;
  affidoIl: string;
  scadenzaMandato: string | null;
  fileName: string | null;
  nPratiche: number;
  createdById: string | null;
  createdByName: string | null;
  createdAt: string;
};

export type ImportBatchCreateInput = {
  tenantId: string;
  tipo?: string;
  mandanteId: string;
  mandanteCodice: string;
  perimetro: string;
  lotto: string;
  affidoIl: string | Date;
  scadenzaMandato?: string | Date | null;
  fileName?: string | null;
  nPratiche?: number;
  createdById?: string | null;
  createdByName?: string | null;
};

export type ImportBatchUpdateInput = {
  nPratiche?: number;
  fileName?: string | null;
  scadenzaMandato?: string | Date | null;
};

export type ImportBatchFilter = {
  tenantId: string;
  tipo?: string;
  id?: string;
  mandanteId?: string;
  perimetro?: string;
  lotto?: string;
};

export type ImportPraticaCreateItem = {
  debitore: {
    nome: string;
    cognome: string;
    codiceFiscale?: string | null;
    telefono?: string | null;
    citta?: string | null;
    indirizzo?: string | null;
    cap?: string | null;
    provincia?: string | null;
  };
  pratica: {
    mandanteId: string;
    numeroMandante: string;
    contratto?: string | null;
    commessa?: string | null;
    dataAffido: string;
    scadenza?: string | null;
    capitale: number;
    interessi: number;
    spese: number;
    speseRecupero: number;
    residuo: number;
    importoRata?: number | null;
    rateArretrate?: number | null;
    nettoDaPagare: number;
    stato: string;
    importBatchId: string;
  };
};

export type ImportPraticaUpdateItem = {
  praticaId: string;
  debitoreId: string;
  debitore: Record<string, unknown>;
  pratica: Record<string, unknown>;
};

export type ImportChunkResult = {
  created: number;
  updated: number;
  skipped: number;
  createdPratiche?: Array<{ id: string; debitoreId: string; contratto: string | null; commessa: string | null; stato: string; codiceFiscale: string | null }>;
};

export interface ImportBatchRepository {
  findByLotKey(
    tenantSlug: string,
    tenantId: string,
    input: { mandanteId: string; perimetro: string; lotto: string; tipo?: string }
  ): Promise<ImportBatchDto | null>;
  getById(tenantSlug: string, tenantId: string, id: string): Promise<ImportBatchDto | null>;
  list(tenantSlug: string, tenantId: string, filter?: { tipo?: string; take?: number }): Promise<ImportBatchDto[]>;
  create(tenantSlug: string, tenantId: string, data: ImportBatchCreateInput): Promise<ImportBatchDto>;
  update(tenantSlug: string, tenantId: string, id: string, data: ImportBatchUpdateInput): Promise<ImportBatchDto>;
  delete(tenantSlug: string, tenantId: string, id: string): Promise<void>;
  processImportChunk(
    tenantSlug: string,
    tenantId: string,
    input: {
      creates: ImportPraticaCreateItem[];
      updates: ImportPraticaUpdateItem[];
    }
  ): Promise<ImportChunkResult>;
  linkPraticheToBatch(
    tenantSlug: string,
    tenantId: string,
    input: {
      batchId: string;
      mandanteId: string;
      lotto: string;
      affidoIl: string;
    }
  ): Promise<{ totale: number }>;
  deletePraticaForImport(tenantSlug: string, tenantId: string, praticaId: string): Promise<void>;
}
