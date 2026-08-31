import type { Role } from "@/lib/permissions";
import type { SortDir, SortField } from "@/lib/praticaOrdine";

/** Scope ruolo — calcolato server-side da sessione, mai dal browser. */
export type PraticaScope = {
  tenantId: string;
  role: Role;
  userId: string;
  /** Supervisor: id operatori del team */
  memberIds?: string[];
};

export type PraticaInclude =
  | "debitore"
  | "debitoreRecapiti"
  | "mandante"
  | "assegnatario"
  | "rate"
  | "incassi"
  | "incassiUser"
  | "garanti"
  | "garantiRecapiti"
  | "attivita"
  | "attivitaUser"
  | "fatture"
  | "documenti"
  | "importBatch";

export type PraticaListFilter = {
  ids?: string[];
  excludeIds?: string[];
  idsIn?: string[];
  q?: string;
  stato?: string;
  stati?: string[];
  notStati?: string[];
  esito?: string;
  mandanteId?: string;
  mandanteIds?: string[];
  assegnatarioId?: string;
  assegnatarioIdsIn?: string[];
  operatoreId?: string;
  numeroMandante?: string;
  numeroMandantiIn?: string[];
  numeroMandanteNotNull?: boolean;
  /** OR perimetri gruppo: mandanteId + optional lotti */
  perimetroOr?: Array<{ mandanteId: string; numeroMandanti?: string[] }>;
  debitoreContains?: string;
  capGte?: string;
  capLte?: string;
  cittaContains?: string;
  provContains?: string;
  telefonoContains?: string;
  cfPivaContains?: string;
  garanteContains?: string;
  noteContains?: string;
  nPraticaGte?: string;
  nPraticaLte?: string;
  codScarico?: string;
  affidoGte?: string;
  affidoLt?: string;
  affidoLte?: string;
  scadenzaGte?: string;
  scadenzaLt?: string;
  promessaGte?: string;
  promessaLt?: string;
  memoGte?: string;
  memoLt?: string;
  memoAtGte?: string;
  memoAtLt?: string;
  residuoGte?: number;
  residuoLte?: number;
  importoRataGte?: number;
  importoRataLte?: number;
  importoTotGte?: number;
  importoTotLte?: number;
  totIncassatoGte?: number;
  totIncassatoLte?: number;
  hasAssegnatario?: boolean;
  rateScadute?: boolean;
  hasIncassoInRange?: { gte?: string; lt?: string };
  /** Ricerca typeahead per campo */
  searchCampo?: string;
  searchTerm?: string;
};

export type PraticaListRequest = {
  tenantSlug: string;
  scope: PraticaScope;
  filter?: PraticaListFilter;
  sort?: { field: SortField; dir: SortDir };
  page?: number;
  pageSize?: number;
  skip?: number;
  take?: number;
  include?: PraticaInclude[];
};

export type PraticaListResult = {
  items: PraticaDto[];
  total: number;
  page: number;
  pageSize: number;
  queryMs?: number;
};

export type PraticaDto = Record<string, unknown>;

export type PraticaUpdateInput = {
  updatedAt?: Date;
  ultimaLavorazioneAt?: Date | null;
  codiceScarico?: string | null;
  codiceScaricoAt?: Date | null;
  stato?: string;
  esitoContatto?: string | null;
  tipoContatto?: string | null;
  memoAt?: Date | null;
  promessaAt?: Date | null;
  promessaImporto?: number | null;
  assegnatarioId?: string | null;
  operatoreTitolareId?: string | null;
  residuo?: number;
  debitoreId?: string;
  mandanteId?: string;
  numero?: string;
  numeroMandante?: string | null;
  contratto?: string | null;
  commessa?: string | null;
  dataAffido?: Date | null;
  scadenza?: Date | null;
  capitale?: number;
  interessi?: number;
  spese?: number;
  speseRecupero?: number;
  importoRata?: number | null;
  rateArretrate?: number | null;
  nettoDaPagare?: number | null;
  importBatchId?: string | null;
};

export type PraticaCreateInput = PraticaUpdateInput & {
  tenantId: string;
  debitoreId: string;
  mandanteId: string;
  numero: string;
};

export type AssignPraticaInput = {
  tipo: "ripristina" | "temporaneo" | "definitivo" | "unassign";
  assegnatarioId?: string | null;
  titolareId?: string | null;
  statoCorrente?: string;
};

export interface PraticheRepository {
  getById(
    tenantSlug: string,
    tenantId: string,
    id: string,
    include?: PraticaInclude[]
  ): Promise<PraticaDto | null>;

  list(req: PraticaListRequest): Promise<PraticaListResult>;

  count(req: Omit<PraticaListRequest, "page" | "pageSize" | "skip" | "take" | "sort" | "include">): Promise<number>;

  groupByNumeroMandante(
    tenantSlug: string,
    scope: PraticaScope,
    filter?: PraticaListFilter
  ): Promise<Array<{ numeroMandante: string | null }>>;

  idsAffidoTemporaneo(tenantSlug: string, tenantId: string): Promise<string[]>;

  idsImportoTotale(
    tenantSlug: string,
    tenantId: string,
    da?: number,
    a?: number
  ): Promise<string[]>;

  idsTotIncassato(
    tenantSlug: string,
    tenantId: string,
    da?: number,
    a?: number
  ): Promise<string[]>;

  nextNumero(tenantSlug: string, tenantId: string): Promise<string>;

  create(tenantSlug: string, data: PraticaCreateInput): Promise<PraticaDto>;

  update(
    tenantSlug: string,
    tenantId: string,
    id: string,
    data: PraticaUpdateInput
  ): Promise<PraticaDto>;

  delete(tenantSlug: string, tenantId: string, id: string): Promise<void>;

  assign(
    tenantSlug: string,
    tenantId: string,
    id: string,
    input: AssignPraticaInput
  ): Promise<void>;

  updateStato(
    tenantSlug: string,
    tenantId: string,
    id: string,
    stato: string,
    promessaAt?: Date | null
  ): Promise<void>;

  canAccess(
    tenantSlug: string,
    scope: PraticaScope,
    praticaId: string,
    linkedIds?: string[]
  ): Promise<boolean>;
}
