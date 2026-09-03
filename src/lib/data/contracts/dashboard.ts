import type {
  RigaCodiciMandantePerimetro,
  RigaDaAffidarePerimetro,
  RigaInLavorazionePerimetro,
} from "@/lib/codiciMandantePerimetroUi";
import type {
  OperatoreLavorateGiorno,
  PraticaCambioCodiceGiorno,
  PraticaLavorataOggi,
} from "@/lib/lavorateOggiUi";

/** Filtro scope serializzabile per SQL (no Prisma). */
export type HomeScopeFilter = {
  mode: "none" | "tenant" | "operator" | "supervisor" | "members";
  userId?: string;
  memberIds?: string[];
  /** OR (mandanteId [, numeriMandante]) — overlay gruppo perimetro */
  perimetroOr?: Array<{ mandanteId: string; numeriMandante?: string[] }>;
  sedeId?: string;
};

export type HomeKpiContext = {
  tenantSlug: string;
  tenantId: string;
  role: string;
  userId: string;
  sedeScopeId?: string | null;
  lavorateDate: string;
  incMandante?: string;
  incPerimetro?: string;
  /** YYYY-MM — mese per colonne incassi; default mese corrente */
  incMese?: string;
  includeProduttivita?: boolean;
  scope: HomeScopeFilter;
  /** Incassi oggi: tutti tenant vs solo operatore */
  incassiScope: "none" | "tenant" | "user";
  includeAdmin: boolean;
  includeAmministrazione: boolean;
  vistaGruppoLavorate: boolean;
  mostraGruppo: boolean;
  gruppoMandanti?: Array<{ mandanteId: string; perimetriIds: string[] }>;
  memberIds?: string[];
  /** Sede operatore per ricavi provvigioni (AMMINISTRAZIONE) */
  sedeRicaviId?: string | null;
  mostraRicavi?: boolean;
};

export type RiepilogoMandanteDto = {
  id: string;
  codice: string;
  ragioneSociale: string;
  pratiche: number;
  affidato: number;
  incassato: number;
  ricavoLordo: number;
  percentuale: number;
};

export type TipologiaIncassoDto = {
  metodo: string;
  pezzi: number;
  importo: number;
  meseImporto: number;
  mesePezzi: number;
};

export type CaricoGruppoDto = {
  nome: string;
  aperte: number;
  totali: number;
  membri: number;
};

export type HomeKpiShared = {
  totali: number;
  scadute: number;
  incassiOggiSum: number;
  inLavoroPerPerimetro: RigaInLavorazionePerimetro[];
  lavoratePerOperatore: OperatoreLavorateGiorno[];
  praticheLavorateGruppo: PraticaLavorataOggi[];
  praticheCambioCodice: PraticaCambioCodiceGiorno[];
  codiciMandantePerimetro: RigaCodiciMandantePerimetro[];
  daAffidareGruppo: RigaDaAffidarePerimetro[];
};

export type HomeKpiAdmin = {
  sediOpts: Array<{ id: string; nome: string }>;
  operatoriCount: number;
  mandantiRiepilogo: RiepilogoMandanteDto[];
  mandantiFiltriUi: Array<{
    id: string;
    codice: string;
    ragioneSociale: string;
    perimetri: string[];
  }>;
  tipologieIncasso: TipologiaIncassoDto[];
  /** Caricata solo con includeProduttivita nel contesto richiesta. */
  produttivita?: Array<{ name: string; oggi: number; mese: number }>;
  caricoGruppi: CaricoGruppoDto[];
  codiciScaricoRiepilogo: Array<{ codice: string; oggi: number; mese: number }>;
  esitiContatto: Array<{ esitoContatto: string; count: number }>;
  nuove: number;
  inLavorazione: number;
  inScadenza7gg: number;
  nonAssegnate: number;
  incassiPerMandanteMese: Array<{
    mese: string;
    mandanti: Array<{ codice: string; importo: number }>;
    totale: number;
  }>;
  mandantiAttivi: Array<{ id: string; codice: string }>;
};

export type HomeKpiAmministrazione = {
  sediOpts: Array<{ id: string; nome: string }>;
  totPratiche: number;
  provvigioniMeseSum: number | null;
  provvigioniDaLiquidareSum: number | null;
  mandantiCount: number;
  operatoriCount: number;
  mostraRicavi: boolean;
  sedeFiltro?: string | null;
};

export type HomeKpiBundle = {
  shared: HomeKpiShared;
  admin?: HomeKpiAdmin;
  amministrazione?: HomeKpiAmministrazione;
  meta: {
    queryMs: number;
    sqlQueries: number;
    roundTrips: number;
  };
};

export interface DashboardRepository {
  getHomeKpi(ctx: HomeKpiContext): Promise<HomeKpiBundle>;
}
