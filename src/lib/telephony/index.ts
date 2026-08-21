export { TelephonyRegistry } from "./registry";
export { TelephonyService } from "./service";
export { DefaultTelProvider, CounterPathSoftphoneProvider } from "./providers";
export { TelephonyNotSupported } from "./types";
export {
  getTenantTelephonyConfig,
  getDialClientConfig,
  parseTenantTelephonyConfig,
  toDialClientConfig,
  normalizeVoipProvider,
  normalizeSoftphoneProtocol,
} from "./config";
export type {
  SoftphoneProtocol,
  VoipProviderKey,
  TenantTelephonyConfig,
  DialClientConfig,
} from "./config";
export type {
  CallDirection,
  CallEvent,
  CallEventHandler,
  CallStatus,
  DialOptions,
  OperatorPresence,
  TelephonyCapabilities,
  TelephonyProvider,
} from "./types";
