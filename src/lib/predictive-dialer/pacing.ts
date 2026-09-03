import type { DialerSessioneStato } from "@/lib/predictive-dialer/constants";

export const DIALER_PACING_MIN = 0.1;
export const DIALER_PACING_MAX = 10;
export const DIALER_PACING_DEFAULT = 1;

export function normalizePacingRatio(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return DIALER_PACING_DEFAULT;
  return Math.min(DIALER_PACING_MAX, Math.max(DIALER_PACING_MIN, Math.round(n * 10) / 10));
}

export type DialerPacingMetrics = {
  /** Rapporto configurato dal supervisor (es. 1.0, 1.5, 2.0). */
  pacingRatio: number;
  operatoriDisponibili: number;
  /** Stima locale: disponibili × pacing. Non è velocità reale del provider. */
  chiamateSimultaneeStimate: number;
  praticheInCoda: number;
  /** Chiamate/minuto dal provider. Null se non disponibile. */
  actualCallsPerMinute: number | null;
  actualCallsPerMinuteSource: "provider" | "unavailable";
};

export function chiamateDaFarePerOperatore(
  sessioneStato: DialerSessioneStato,
  pacingRatio: number
): number {
  if (sessioneStato !== "disponibile") return 0;
  return normalizePacingRatio(pacingRatio);
}

export function computePacingMetrics(input: {
  pacingRatio: number | null | undefined;
  operatoriDisponibili: number;
  praticheRimanenti: number;
  actualCallsPerMinute?: number | null;
  providerConnected?: boolean;
}): DialerPacingMetrics {
  const pacingRatio = normalizePacingRatio(input.pacingRatio ?? DIALER_PACING_DEFAULT);
  const chiamateSimultaneeStimate =
    input.operatoriDisponibili > 0
      ? Math.round(input.operatoriDisponibili * pacingRatio * 10) / 10
      : 0;

  const hasProviderRate =
    input.providerConnected === true && input.actualCallsPerMinute != null;

  return {
    pacingRatio,
    operatoriDisponibili: input.operatoriDisponibili,
    chiamateSimultaneeStimate,
    praticheInCoda: input.praticheRimanenti,
    actualCallsPerMinute: hasProviderRate ? input.actualCallsPerMinute! : null,
    actualCallsPerMinuteSource: hasProviderRate ? "provider" : "unavailable",
  };
}
