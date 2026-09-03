import type {
  DialerCampagnaStato,
  DialerEventoTipo,
  DialerPraticaStato,
  DialerSessioneStato,
} from "@/lib/predictive-dialer/constants";

export type DialerCampagnaDto = {
  id: string;
  nome: string;
  descrizione: string;
  codiciScarico: string[];
  postCallSec: number;
  stato: DialerCampagnaStato;
  pacingRatio: number | null;
  externalId: string | null;
  activatedAt: string | null;
  createdAt: string;
};

export type DialerOperatoreSessioneDto = {
  campagnaId: string;
  campagnaNome: string;
  operatoreId: string;
  sessioneStato: DialerSessioneStato;
  accettatoAt: string | null;
  pausaInizioAt: string | null;
  postCallFineAt: string | null;
  postCallSec: number;
  praticaCorrenteId: string | null;
  chiamateCount: number;
  durataTotaleSec: number;
};

export type DialerInvitoCampagnaDto = {
  campagna: DialerCampagnaDto;
  invitatoAt: string;
  accettatoAt: string | null;
};

export type DialerMonitorOperatoreDto = {
  operatoreId: string;
  operatoreNome: string;
  sessioneStato: DialerSessioneStato;
  pausaInizioAt: string | null;
  pausaDurataSec: number;
  chiamateCount: number;
  /** Pratiche distinte con almeno un evento collegata. */
  praticheParlate: number;
  durataTotaleSec: number;
  durataMediaSec: number;
  praticaCorrenteId: string | null;
  /** Linee outbound stimate per questo operatore (0 se non disponibile). */
  chiamateDaFare: number;
};

export type DialerPacingMetricsDto = {
  pacingRatio: number;
  operatoriDisponibili: number;
  chiamateSimultaneeStimate: number;
  praticheInCoda: number;
  actualCallsPerMinute: number | null;
  actualCallsPerMinuteSource: "provider" | "unavailable";
};

export type DialerCampagnaStatsDto = {
  praticheTotali: number;
  praticheLavorate: number;
  praticheRimanenti: number;
  /** Pratiche/clienti in campagna all'attivazione (totale in coda). */
  clientiTotali: number;
  clientiToccati: number;
  clientiRimanenti: number;
  numeriTotali: number;
  numeriToccati: number;
  numeriRimanenti: number;
  /** @deprecated alias numeriToccati */
  numeriChiamati: number;
  chiamateTotali: number;
  chiamateRisposta: number;
  chiamateNoRisposta: number;
  chiamateOccupato: number;
  chiamateErrore: number;
  operatoriDisponibili: number;
  operatoriConnecting: number;
  operatoriInChiamata: number;
  operatoriOccupati: number;
  operatoriInPausa: number;
  operatoriFuori: number;
  operatoriPostCall: number;
  perCodiceScarico: Array<{
    codice: string;
    praticheTotali: number;
    praticheLavorate: number;
    praticheRimanenti: number;
    praticheToccati: number;
    chiamateTotali: number;
  }>;
  campagnaStato: string;
  pacing: DialerPacingMetricsDto;
  dialerStato: {
    connesso: boolean;
    pacingRatio: number | null;
    actualCallsPerMinute: number | null;
    messaggio: string;
    providerSupportsSetPacing: boolean;
  };
};

export type DialerCallEventInput = {
  campagnaId: string;
  operatoreId?: string;
  praticaId?: string;
  numero?: string;
  tipo: DialerEventoTipo;
  esito?: string;
  durataSec?: number;
  /** Identificativo univoco della telefonata (preferito). */
  callId?: string;
  /** Alias retrocompatibile per callId. */
  externalCallId?: string;
  /** Id evento dal provider VoIP (deduplicazione). */
  providerEventId?: string;
  metadata?: Record<string, unknown>;
  /** Affida solo su evento collegata, se la pratica non è già affidata. */
  affidaSeCollegata?: boolean;
};

export type DialerPraticaQueueItem = {
  id: string;
  praticaId: string;
  numero: string;
  codiceScarico: string | null;
  stato: DialerPraticaStato;
  tentativi: number;
  ultimoEsito: string | null;
};
