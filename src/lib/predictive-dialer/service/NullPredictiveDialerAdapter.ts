import type {
  DialerCampaignStatus,
  DialerOperatorRef,
  DialerQueueEntry,
  PredictiveDialerService,
} from "@/lib/predictive-dialer/service/PredictiveDialerService";
import type { DialerCampagnaDto } from "@/lib/predictive-dialer/types";

/** Adapter stub: nessuna connessione VoIP finché non viene configurato un provider reale. */
export class NullPredictiveDialerAdapter implements PredictiveDialerService {
  readonly providerId = "null";

  async startCampaign(campagna: DialerCampagnaDto, _queue: DialerQueueEntry[]) {
    return { externalId: `local:${campagna.id}` };
  }

  async stopCampaign(_externalCampaignId: string) {}

  async pauseCampaign(_externalCampaignId: string) {}

  async resumeCampaign(_externalCampaignId: string) {}

  async addOperator(_externalCampaignId: string, _operator: DialerOperatorRef) {}

  async removeOperator(_externalCampaignId: string, _operator: DialerOperatorRef) {}

  async setOperatorAvailable(_externalCampaignId: string, _operator: DialerOperatorRef, _available: boolean) {}

  async setOperatorPaused(_externalCampaignId: string, _operator: DialerOperatorRef) {}

  async syncQueue(_externalCampaignId: string, _queue: DialerQueueEntry[]) {}

  async getCampaignStatus(_externalCampaignId: string): Promise<DialerCampaignStatus> {
    return {
      connesso: false,
      actualCallsPerMinute: null,
      messaggio: "Provider dialer non configurato",
    };
  }
}
