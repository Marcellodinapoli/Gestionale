"use client";

import Link from "next/link";
import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { Phone } from "lucide-react";
import { Modal } from "@/components/Modal";
import type { DialClientConfig } from "@/lib/telephony/clientConfig";
import {
  chiamaNumero as chiamaNumeroRaw,
  withPrefisso,
} from "@/lib/clickToCall";

export type DialContextValue = DialClientConfig & {
  prefissoChiamata: string;
  interno: string;
  richiedeInterno: boolean;
};

const DEFAULT: DialContextValue = {
  protocol: "callto",
  sipDomain: "",
  provider: "counterpath",
  prefissoChiamata: "",
  interno: "",
  richiedeInterno: false,
};

const TelephonyDialContext = createContext<DialContextValue>(DEFAULT);

type AvvisoCentralino = "interno" | "prefisso" | null;

type TelephonyUiContextValue = {
  avvisaInternoMancante: () => void;
  avvisaPrefissoMancante: () => void;
};

const TelephonyUiContext = createContext<TelephonyUiContextValue>({
  avvisaInternoMancante: () => undefined,
  avvisaPrefissoMancante: () => undefined,
});

export function TelephonyDialProvider({
  config,
  prefissoChiamata = "",
  interno = "",
  richiedeInterno = false,
  children,
}: {
  config: DialClientConfig;
  prefissoChiamata?: string | null;
  interno?: string | null;
  richiedeInterno?: boolean;
  children: ReactNode;
}) {
  const [avviso, setAvviso] = useState<AvvisoCentralino>(null);

  const value: DialContextValue = {
    ...config,
    prefissoChiamata: (prefissoChiamata || "").trim(),
    interno: (interno || "").trim(),
    richiedeInterno,
  };

  const avvisaInternoMancante = useCallback(() => setAvviso("interno"), []);
  const avvisaPrefissoMancante = useCallback(() => setAvviso("prefisso"), []);

  return (
    <TelephonyDialContext.Provider value={value}>
      <TelephonyUiContext.Provider
        value={{ avvisaInternoMancante, avvisaPrefissoMancante }}
      >
        {children}
        <Modal
          open={avviso === "interno"}
          title="Interno non configurato"
          onClose={() => setAvviso(null)}
        >
          <div className="space-y-4 p-4">
            <p className="text-sm leading-relaxed text-[var(--navy)]">
              Per effettuare chiamate devi impostare l&apos;interno con cui chiamare in{" "}
              <strong>Account → Centralino</strong>, oppure selezionare una postazione che ne
              abbia uno.
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setAvviso(null)}
                className="h-9 rounded-lg border border-[var(--line)] px-3 text-sm font-semibold text-[var(--navy)] hover:bg-slate-50"
              >
                Chiudi
              </button>
              <Link
                href="/account"
                onClick={() => setAvviso(null)}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[var(--navy)] px-3 text-sm font-semibold text-white hover:bg-[#1a365d]"
              >
                <Phone className="h-4 w-4" />
                Vai all&apos;account
              </Link>
            </div>
          </div>
        </Modal>
        <Modal
          open={avviso === "prefisso"}
          title="Prefisso chiamata non configurato"
          onClose={() => setAvviso(null)}
        >
          <div className="space-y-4 p-4">
            <p className="text-sm leading-relaxed text-[var(--navy)]">
              Per effettuare chiamate dalla scheda cliente devi impostare il{" "}
              <strong>prefisso</strong> con cui uscire dalla centralina (es.{" "}
              <strong>9</strong>) in <strong>Account → Centralino</strong>.
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setAvviso(null)}
                className="h-9 rounded-lg border border-[var(--line)] px-3 text-sm font-semibold text-[var(--navy)] hover:bg-slate-50"
              >
                Chiudi
              </button>
              <Link
                href="/account"
                onClick={() => setAvviso(null)}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[var(--navy)] px-3 text-sm font-semibold text-white hover:bg-[#1a365d]"
              >
                <Phone className="h-4 w-4" />
                Vai all&apos;account
              </Link>
            </div>
          </div>
        </Modal>
      </TelephonyUiContext.Provider>
    </TelephonyDialContext.Provider>
  );
}

export function useDialConfig(): DialContextValue {
  return useContext(TelephonyDialContext);
}

export function usePrefissoChiamata(): string {
  return useDialConfig().prefissoChiamata;
}

/** Click-to-call con protocollo softphone e prefisso operatore. Ritorna false se bloccata. */
export function useChiamaNumero() {
  const cfg = useDialConfig();
  const { avvisaInternoMancante, avvisaPrefissoMancante } =
    useContext(TelephonyUiContext);

  return useCallback(
    (numero: string): boolean => {
      if (cfg.richiedeInterno && !cfg.interno) {
        avvisaInternoMancante();
        return false;
      }
      if (!cfg.prefissoChiamata) {
        avvisaPrefissoMancante();
        return false;
      }
      chiamaNumeroRaw(withPrefisso(numero, cfg.prefissoChiamata), {
        protocol: cfg.protocol,
        sipDomain: cfg.sipDomain,
      });
      return true;
    },
    [cfg, avvisaInternoMancante, avvisaPrefissoMancante]
  );
}
