export const DIALER_CAMPAGNA_STATI = ["BOZZA", "ATTIVA", "PAUSA", "TERMINATA"] as const;
export type DialerCampagnaStato = (typeof DIALER_CAMPAGNA_STATI)[number];

export const DIALER_SESSIONE_STATI = [
  "offline",
  "disponibile",
  "connecting",
  "in_chiamata",
  "post_call",
  "pausa",
  "fuori",
] as const;
export type DialerSessioneStato = (typeof DIALER_SESSIONE_STATI)[number];

export const DIALER_PRATICA_STATI = [
  "disponibile",
  "in_coda",
  "in_lavorazione",
  "richiamare",
  "non_risposta",
  "conclusa",
] as const;
export type DialerPraticaStato = (typeof DIALER_PRATICA_STATI)[number];

export const DIALER_EVENTO_TIPI = [
  "iniziata",
  "risposta",
  "collegata",
  "terminata",
  "no_risposta",
  "occupato",
  "errore",
] as const;
export type DialerEventoTipo = (typeof DIALER_EVENTO_TIPI)[number];

export const DIALER_SESSIONE_LABELS: Record<DialerSessioneStato, string> = {
  offline: "Offline",
  disponibile: "Disponibile",
  connecting: "Chiamata in corso",
  in_chiamata: "In chiamata",
  post_call: "Post-call",
  pausa: "In pausa",
  fuori: "Fuori dal dialer",
};

export const DIALER_CAMPAGNA_LABELS: Record<DialerCampagnaStato, string> = {
  BOZZA: "Bozza",
  ATTIVA: "Attiva",
  PAUSA: "In pausa",
  TERMINATA: "Terminata",
};

export const DIALER_CONFIG_CATEGORIA = "predictive_dialer";
export const DIALER_CONFIG_PROVIDER = "dialer.provider";
export const DIALER_CONFIG_WEBHOOK_SECRET = "dialer.webhookSecret";
export const DIALER_CONFIG_API_BASE = "dialer.apiBaseUrl";

/** Timeout default blocco pratica in_lavorazione senza evento conclusivo (secondi). */
export const DIALER_DEFAULT_LOCK_TIMEOUT_SEC = 120;
/** Timeout assenza heartbeat operatore in connecting/in_chiamata (secondi). */
export const DIALER_SESSION_HEARTBEAT_TIMEOUT_SEC = 90;

export const DIALER_EVENTI_CONCLUSIVI = [
  "collegata",
  "terminata",
  "no_risposta",
  "occupato",
  "errore",
] as const;
