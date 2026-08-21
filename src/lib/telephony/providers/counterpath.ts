import {
  TelephonyNotSupported,
  type CallEventHandler,
  type DialOptions,
  type OperatorPresence,
  type TelephonyCapabilities,
  type TelephonyProvider,
} from "../types";
import {
  normalizeSoftphoneProtocol,
  type SoftphoneProtocol,
} from "../config";
import { buildDialHref } from "@/lib/clickToCall";

const CAPS: TelephonyCapabilities = {
  canDial: true,
  canReceive: true,
  canRecord: false,
  canTransfer: false,
  canHold: false,
  canListenLive: false,
  canWhisper: false,
  canBarge: false,
  canGetPresence: false,
};

/**
 * Softphone CounterPath (Bria / X-Lite): il gestionale avvia la chiamata
 * con protocollo OS (callto: / sip: / tel:), il client sul PC dell'operatore
 * (registrato al PBX via VPN) compone il numero.
 */
export class CounterPathSoftphoneProvider implements TelephonyProvider {
  readonly name = "counterpath-softphone";
  readonly capabilities = CAPS;

  private protocol: SoftphoneProtocol = "callto";
  private sipDomain = "";
  private counter = 0;

  async initialize(config: Record<string, unknown>): Promise<void> {
    this.protocol = normalizeSoftphoneProtocol(
      typeof config.softphoneProtocol === "string"
        ? config.softphoneProtocol
        : typeof config.protocol === "string"
          ? config.protocol
          : "callto"
    );
    this.sipDomain =
      typeof config.sipDomain === "string" ? config.sipDomain.trim() : "";
  }

  async dispose(): Promise<void> {
    /* noop */
  }

  async dial(options: DialOptions): Promise<{ callId: string }> {
    const callId = `cp-${++this.counter}-${Date.now()}`;
    const href = buildDialHref(options.numero, {
      protocol: this.protocol,
      sipDomain: this.sipDomain,
    });
    if (href && typeof window !== "undefined") {
      window.location.href = href;
    }
    return { callId };
  }

  async hangup(_callId: string): Promise<void> {
    throw new TelephonyNotSupported(this.name, "hangup");
  }

  async hold(_callId: string): Promise<void> {
    throw new TelephonyNotSupported(this.name, "hold");
  }

  async unhold(_callId: string): Promise<void> {
    throw new TelephonyNotSupported(this.name, "unhold");
  }

  async transfer(_callId: string, _targetNumero: string): Promise<void> {
    throw new TelephonyNotSupported(this.name, "transfer");
  }

  async listenLive(_callId: string): Promise<void> {
    throw new TelephonyNotSupported(this.name, "listenLive");
  }

  async whisper(_callId: string): Promise<void> {
    throw new TelephonyNotSupported(this.name, "whisper");
  }

  async barge(_callId: string): Promise<void> {
    throw new TelephonyNotSupported(this.name, "barge");
  }

  async getOperatorStatus(_operatoreId: string): Promise<OperatorPresence> {
    throw new TelephonyNotSupported(this.name, "getOperatorStatus");
  }

  onCallEvent(_handler: CallEventHandler): () => void {
    return () => {};
  }
}
