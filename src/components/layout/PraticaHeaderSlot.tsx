"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type PraticaHeaderSlotContextValue = {
  slot: ReactNode | null;
  setSlot: (node: ReactNode | null) => void;
};

const PraticaHeaderSlotContext = createContext<PraticaHeaderSlotContextValue | null>(
  null
);

export function PraticaHeaderSlotProvider({ children }: { children: ReactNode }) {
  const [slot, setSlot] = useState<ReactNode | null>(null);
  const value = useMemo(() => ({ slot, setSlot }), [slot]);
  return (
    <PraticaHeaderSlotContext.Provider value={value}>
      {children}
    </PraticaHeaderSlotContext.Provider>
  );
}

export function usePraticaHeaderSlot() {
  const ctx = useContext(PraticaHeaderSlotContext);
  if (!ctx) {
    throw new Error("usePraticaHeaderSlot must be used within PraticaHeaderSlotProvider");
  }
  return ctx;
}

export function PraticaHeaderSlotDisplay() {
  const { slot } = useContext(PraticaHeaderSlotContext) ?? { slot: null };
  if (!slot) return null;
  return <span className="hidden shrink-0 sm:inline-flex sm:items-center">{slot}</span>;
}
