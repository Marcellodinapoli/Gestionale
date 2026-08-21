export type CallDirection = "inbound" | "outbound";

export type CallStatus =
  | "ringing"
  | "answered"
  | "busy"
  | "no_answer"
  | "failed"
  | "completed";

export interface CallEvent {
  callId: string;
  praticaId?: string;
  operatoreId: string;
  numero: string;
  direzione: CallDirection;
  status: CallStatus;
  timestamp: Date;
  durataSec?: number;
  recordingUrl?: string;
}

export interface DialOptions {
  numero: string;
  praticaId?: string;
  operatoreId?: string;
  callerId?: string;
}

export interface TelephonyCapabilities {
  canDial: boolean;
  canReceive: boolean;
  canRecord: boolean;
  canTransfer: boolean;
  canHold: boolean;
  /** Supervisore ascolta la chiamata in tempo reale */
  canListenLive: boolean;
  /** Supervisore parla solo all'operatore (il cliente non sente) */
  canWhisper: boolean;
  /** Supervisore entra in conferenza a tre */
  canBarge: boolean;
  /** Stato presenza operatore (libero / occupato / offline) */
  canGetPresence: boolean;
}

export type OperatorPresence = "available" | "busy" | "offline";

export type CallEventHandler = (event: CallEvent) => void;

/**
 * Interfaccia che ogni provider di telefonia deve implementare.
 *
 * I metodi non supportati devono lanciare `TelephonyNotSupported`.
 * Controllare `capabilities` prima di chiamare metodi opzionali.
 */
export interface TelephonyProvider {
  readonly name: string;
  readonly capabilities: TelephonyCapabilities;

  initialize(config: Record<string, unknown>): Promise<void>;
  dispose(): Promise<void>;

  dial(options: DialOptions): Promise<{ callId: string }>;
  hangup(callId: string): Promise<void>;
  hold(callId: string): Promise<void>;
  unhold(callId: string): Promise<void>;
  transfer(callId: string, targetNumero: string): Promise<void>;

  listenLive(callId: string): Promise<void>;
  whisper(callId: string): Promise<void>;
  barge(callId: string): Promise<void>;

  getOperatorStatus(operatoreId: string): Promise<OperatorPresence>;

  onCallEvent(handler: CallEventHandler): () => void;
}

export class TelephonyNotSupported extends Error {
  constructor(provider: string, method: string) {
    super(`[${provider}] ${method} non supportato`);
    this.name = "TelephonyNotSupported";
  }
}
