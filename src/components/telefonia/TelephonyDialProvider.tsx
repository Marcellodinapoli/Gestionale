"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { DialClientConfig } from "@/lib/telephony/config";
import {
  chiamaNumero as chiamaNumeroRaw,
  withPrefisso,
} from "@/lib/clickToCall";

export type DialContextValue = DialClientConfig & {
  prefissoChiamata: string;
};

const DEFAULT: DialContextValue = {
  protocol: "callto",
  sipDomain: "",
  provider: "counterpath",
  prefissoChiamata: "",
};

const TelephonyDialContext = createContext<DialContextValue>(DEFAULT);

export function TelephonyDialProvider({
  config,
  prefissoChiamata = "",
  children,
}: {
  config: DialClientConfig;
  prefissoChiamata?: string | null;
  children: ReactNode;
}) {
  const value: DialContextValue = {
    ...config,
    prefissoChiamata: (prefissoChiamata || "").trim(),
  };
  return (
    <TelephonyDialContext.Provider value={value}>
      {children}
    </TelephonyDialContext.Provider>
  );
}

export function useDialConfig(): DialContextValue {
  return useContext(TelephonyDialContext);
}

export function usePrefissoChiamata(): string {
  return useDialConfig().prefissoChiamata;
}

/** Click-to-call con protocollo softphone e prefisso operatore. */
export function useChiamaNumero() {
  const cfg = useDialConfig();
  return (numero: string) =>
    chiamaNumeroRaw(withPrefisso(numero, cfg.prefissoChiamata), {
      protocol: cfg.protocol,
      sipDomain: cfg.sipDomain,
    });
}
