import {
  TelephonyNotSupported,
  type CallEventHandler,
  type DialOptions,
  type OperatorPresence,
  type TelephonyCapabilities,
  type TelephonyProvider,
} from "../types";

const NO_CAPS: TelephonyCapabilities = {
  canDial: true,
  canReceive: false,
  canRecord: false,
  canTransfer: false,
  canHold: false,
  canListenLive: false,
  canWhisper: false,
  canBarge: false,
  canGetPresence: false,
};

/**
 * Provider di default: apre il numero con il protocollo `tel:`.
 * Delega la chiamata effettiva al softphone registrato sul sistema.
 */
export class DefaultTelProvider implements TelephonyProvider {
  readonly name = "default-tel";
  readonly capabilities = NO_CAPS;

  private counter = 0;

  async initialize(_config: Record<string, unknown>): Promise<void> {
    /* noop */
  }

  async dispose(): Promise<void> {
    /* noop */
  }

  async dial(options: DialOptions): Promise<{ callId: string }> {
    const callId = `tel-${++this.counter}-${Date.now()}`;
    if (typeof window !== "undefined") {
      window.location.href = `tel:${options.numero}`;
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
