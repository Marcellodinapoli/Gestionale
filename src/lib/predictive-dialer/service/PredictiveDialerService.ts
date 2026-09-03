import type { DialerCampagnaDto } from "@/lib/predictive-dialer/types";

/** Payload minimo per inviare pratiche/numeri al dialer esterno. */
export type DialerQueueEntry = {
  praticaId: string;
  numero: string;
  codiceScarico?: string | null;
  metadata?: Record<string, unknown>;
};

export type DialerOperatorRef = {
  operatoreId: string;
  interno?: string | null;
};

export type DialerCampaignStatus = {
  connesso: boolean;
  externalCampaignId?: string | null;
  pacingRatio?: number | null;
  /** Chiamate/minuto effettive dal provider (non stima). */
  actualCallsPerMinute?: number | null;
  operatoriDisponibili?: number;
  operatoriOccupati?: number;
  messaggio?: string;
};

/**
 * Astrazione verso un predictive dialer esterno.
 * Implementazioni concrete (es. provider VoIP) vanno in adapter separati.
 */
export interface PredictiveDialerService {
  readonly providerId: string;

  /** Avvia campagna senza inviare l'intera coda: la sync avviene quando ci sono operatori disponibili. */
  startCampaign(campagna: DialerCampagnaDto, queue: DialerQueueEntry[]): Promise<{ externalId: string }>;

  stopCampaign(externalCampaignId: string): Promise<void>;

  pauseCampaign(externalCampaignId: string): Promise<void>;

  resumeCampaign(externalCampaignId: string): Promise<void>;

  addOperator(externalCampaignId: string, operator: DialerOperatorRef): Promise<void>;

  removeOperator(externalCampaignId: string, operator: DialerOperatorRef): Promise<void>;

  setOperatorAvailable(
    externalCampaignId: string,
    operator: DialerOperatorRef,
    available: boolean
  ): Promise<void>;

  setOperatorPaused(externalCampaignId: string, operator: DialerOperatorRef): Promise<void>;

  syncQueue(externalCampaignId: string, queue: DialerQueueEntry[]): Promise<void>;

  setPacing?(externalCampaignId: string, pacingRatio: number): Promise<void>;

  getCampaignStatus?(externalCampaignId: string): Promise<DialerCampaignStatus>;
}
