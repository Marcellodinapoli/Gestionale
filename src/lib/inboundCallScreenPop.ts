/** Evento client: chiamata in entrata (PBX, simulazione o integrazione futura). */
export const INBOUND_CALL_SCREEN_POP = "gestionale:inbound-call-screen-pop";
export const INBOUND_CALL_SCREEN_POP_DEMO = "gestionale:inbound-call-screen-pop-demo";

export const PENDING_INBOUND_SIM_STORAGE_KEY = "credixa.pendingInboundSim";

export type InboundCallScreenPopDetail = {
  /** CLI — numero del chiamante. */
  numero: string;
  /** DID / numero chiamato (modello A, opzionale; per filtri futuri). */
  numeroChiamato?: string;
};

export type InboundCallScreenPopDemoDetail = {
  numero?: string;
};

/** Anteprima popup con dati dimostrativi (senza lookup DB). */
export function mostraDemoInboundScreenPop(numero?: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<InboundCallScreenPopDemoDetail>(INBOUND_CALL_SCREEN_POP_DEMO, {
      detail: { numero: numero?.trim() || "3321000274" },
    })
  );
}

export function notificaChiamataEntrante(numero: string, numeroChiamato?: string) {
  const trimmed = numero.trim();
  if (typeof window === "undefined" || !trimmed) return;
  const called = numeroChiamato?.trim();
  window.dispatchEvent(
    new CustomEvent<InboundCallScreenPopDetail>(INBOUND_CALL_SCREEN_POP, {
      detail: { numero: trimmed, ...(called ? { numeroChiamato: called } : {}) },
    })
  );
}

declare global {
  interface Window {
    /** Solo dev: `__credixaSimulateInbound('3321000274')` da console su qualsiasi pagina. */
    __credixaSimulateInbound?: (numero: string) => void;
    __credixaDemoInboundPop?: (numero?: string) => void;
  }
}

if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  window.__credixaSimulateInbound = notificaChiamataEntrante;
  window.__credixaDemoInboundPop = mostraDemoInboundScreenPop;
}
