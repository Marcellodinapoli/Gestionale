import { TelephonyRegistry } from "./registry";
import { TelephonyNotSupported } from "./types";
import type {
  CallEvent,
  CallEventHandler,
  DialOptions,
  OperatorPresence,
  TelephonyCapabilities,
  TelephonyProvider,
} from "./types";

/**
 * Facade per la telefonia. Delega al provider attivo nel registry.
 *
 * Uso futuro:
 *   const svc = new TelephonyService();
 *   if (svc.can("canDial")) await svc.dial({ numero: "333..." });
 */
export class TelephonyService {
  private get provider(): TelephonyProvider {
    const p = TelephonyRegistry.active();
    if (!p) throw new Error("Nessun provider di telefonia attivo");
    return p;
  }

  get isAvailable(): boolean {
    return TelephonyRegistry.active() !== null;
  }

  get providerName(): string | null {
    return TelephonyRegistry.active()?.name ?? null;
  }

  get capabilities(): TelephonyCapabilities | null {
    return TelephonyRegistry.active()?.capabilities ?? null;
  }

  can(cap: keyof TelephonyCapabilities): boolean {
    return TelephonyRegistry.active()?.capabilities[cap] ?? false;
  }

  async dial(options: DialOptions): Promise<{ callId: string }> {
    return this.provider.dial(options);
  }

  async hangup(callId: string): Promise<void> {
    return this.provider.hangup(callId);
  }

  async hold(callId: string): Promise<void> {
    if (!this.can("canHold")) throw new TelephonyNotSupported(this.provider.name, "hold");
    return this.provider.hold(callId);
  }

  async unhold(callId: string): Promise<void> {
    if (!this.can("canHold")) throw new TelephonyNotSupported(this.provider.name, "unhold");
    return this.provider.unhold(callId);
  }

  async transfer(callId: string, targetNumero: string): Promise<void> {
    if (!this.can("canTransfer")) throw new TelephonyNotSupported(this.provider.name, "transfer");
    return this.provider.transfer(callId, targetNumero);
  }

  async listenLive(callId: string): Promise<void> {
    if (!this.can("canListenLive")) throw new TelephonyNotSupported(this.provider.name, "listenLive");
    return this.provider.listenLive(callId);
  }

  async whisper(callId: string): Promise<void> {
    if (!this.can("canWhisper")) throw new TelephonyNotSupported(this.provider.name, "whisper");
    return this.provider.whisper(callId);
  }

  async barge(callId: string): Promise<void> {
    if (!this.can("canBarge")) throw new TelephonyNotSupported(this.provider.name, "barge");
    return this.provider.barge(callId);
  }

  async getOperatorStatus(operatoreId: string): Promise<OperatorPresence> {
    if (!this.can("canGetPresence")) throw new TelephonyNotSupported(this.provider.name, "getOperatorStatus");
    return this.provider.getOperatorStatus(operatoreId);
  }

  onCallEvent(handler: CallEventHandler): () => void {
    return this.provider.onCallEvent(handler);
  }
}

export { TelephonyNotSupported };
export type { CallEvent, CallEventHandler, DialOptions, OperatorPresence, TelephonyCapabilities };
