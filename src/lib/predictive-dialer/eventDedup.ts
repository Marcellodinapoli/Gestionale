import type { DialerEventoTipo } from "@/lib/predictive-dialer/constants";
import { DIALER_EVENTI_CONCLUSIVI } from "@/lib/predictive-dialer/constants";
import type { DialerCallEventInput } from "@/lib/predictive-dialer/types";

export function resolveCallId(input: Pick<DialerCallEventInput, "callId" | "externalCallId">): string {
  return (input.callId ?? input.externalCallId ?? "").trim();
}

export function buildDedupKey(input: {
  providerEventId?: string | null;
  callId: string;
  tipo: DialerEventoTipo;
}): string {
  const pe = input.providerEventId?.trim();
  if (pe) return `pe:${pe}`;
  const callId = input.callId.trim();
  if (callId) return `c:${callId}:${input.tipo}`;
  return `orphan:${input.tipo}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
}

export function isConclusiveEventType(tipo: DialerEventoTipo): boolean {
  return (DIALER_EVENTI_CONCLUSIVI as readonly string[]).includes(tipo);
}

export type CallProgress = {
  applied: Set<DialerEventoTipo>;
  hasCollegata: boolean;
  hasTerminata: boolean;
  hasFailure: boolean;
};

export function buildCallProgress(appliedTipi: DialerEventoTipo[]): CallProgress {
  const applied = new Set(appliedTipi);
  return {
    applied,
    hasCollegata: applied.has("collegata"),
    hasTerminata: applied.has("terminata"),
    hasFailure: applied.has("no_risposta") || applied.has("occupato") || applied.has("errore"),
  };
}

/**
 * Valuta se un evento può essere applicato allo stato senza corromperlo.
 * Ritorna null se applicabile, altrimenti la motivazione dello skip.
 */
export function evaluateEventSkipReason(
  tipo: DialerEventoTipo,
  progress: CallProgress
): string | null {
  if (progress.applied.has(tipo)) {
    return "evento_gia_applicato";
  }

  if (tipo === "risposta") {
    return null;
  }

  if (tipo === "iniziata") {
    if (progress.hasCollegata || progress.hasTerminata || progress.hasFailure) {
      return "iniziata_dopo_evento_conclusivo";
    }
    return null;
  }

  if (tipo === "collegata") {
    if (progress.hasFailure) return "collegata_dopo_fallimento";
    if (progress.hasTerminata && !progress.hasCollegata) return "collegata_dopo_terminata";
    return null;
  }

  if (tipo === "terminata") {
    return null;
  }

  if (tipo === "no_risposta" || tipo === "occupato" || tipo === "errore") {
    if (progress.hasCollegata) return `${tipo}_dopo_collegata`;
    if (progress.hasTerminata) return `${tipo}_dopo_terminata`;
    return null;
  }

  return null;
}

export function wasCallConnected(progress: CallProgress, sessioneStato?: string | null): boolean {
  return progress.hasCollegata || sessioneStato === "in_chiamata" || sessioneStato === "post_call";
}
