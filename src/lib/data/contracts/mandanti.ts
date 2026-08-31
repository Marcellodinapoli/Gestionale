export type MandanteFilter = {
  ids?: string[];
  idsIn?: string[];
  codice?: string;
  tenantId?: string;
  q?: string;
};

export type MandanteListRequest = {
  tenantSlug: string;
  tenantId: string;
  filter?: MandanteFilter;
  orderBy?: { codice?: "asc" | "desc"; ragioneSociale?: "asc" | "desc" };
  skip?: number;
  take?: number;
  includePraticaCount?: boolean;
};

export type MandanteDto = Record<string, unknown>;

export type MandanteCreateInput = {
  tenantId: string;
  codice: string;
  ragioneSociale: string;
  email?: string | null;
  telefono?: string | null;
  referente?: string | null;
  referenteTelefono?: string | null;
  referenteEmail?: string | null;
  pec?: string | null;
  indirizzo?: string | null;
  citta?: string | null;
  cap?: string | null;
  provincia?: string | null;
  perimetri?: string | null;
  provvigionePerc?: number | null;
  provvigioniMetodo?: string | null;
  incentivoTipo?: string | null;
  incentivoValore?: number | null;
  incentivoSoglia?: number | null;
  incentivoNote?: string | null;
  codiciScarico?: string | null;
  smsPreimpostati?: string | null;
};

export type MandanteUpdateInput = Partial<Omit<MandanteCreateInput, "tenantId" | "codice">>;

export interface MandantiRepository {
  list(req: MandanteListRequest): Promise<{ items: MandanteDto[]; total: number }>;
  count(tenantSlug: string, tenantId: string, filter?: MandanteFilter): Promise<number>;
  getById(
    tenantSlug: string,
    tenantId: string,
    id: string,
    includePraticaCount?: boolean
  ): Promise<MandanteDto | null>;
  create(tenantSlug: string, data: MandanteCreateInput): Promise<MandanteDto>;
  update(
    tenantSlug: string,
    tenantId: string,
    id: string,
    data: MandanteUpdateInput
  ): Promise<MandanteDto>;
  delete(tenantSlug: string, tenantId: string, id: string): Promise<void>;
}
