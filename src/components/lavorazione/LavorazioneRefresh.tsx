"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { RefreshCw } from "lucide-react";

type RefreshFn = () => Promise<void>;

type LavorazioneRefreshContextValue = {
  register: (id: string, fn: RefreshFn) => () => void;
  refreshAll: () => Promise<void>;
  refreshing: boolean;
  lastUpdated: Date | null;
};

const LavorazioneRefreshContext = createContext<LavorazioneRefreshContextValue | null>(
  null
);

export function LavorazioneRefreshProvider({ children }: { children: ReactNode }) {
  const fns = useRef(new Map<string, RefreshFn>());
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const register = useCallback((id: string, fn: RefreshFn) => {
    fns.current.set(id, fn);
    return () => {
      fns.current.delete(id);
    };
  }, []);

  const refreshAll = useCallback(async () => {
    const handlers = [...fns.current.values()];
    if (!handlers.length) return;
    setRefreshing(true);
    try {
      await Promise.all(handlers.map((fn) => fn()));
      setLastUpdated(new Date());
    } finally {
      setRefreshing(false);
    }
  }, []);

  return (
    <LavorazioneRefreshContext.Provider
      value={{ register, refreshAll, refreshing, lastUpdated }}
    >
      {children}
    </LavorazioneRefreshContext.Provider>
  );
}

export function useLavorazioneRefreshRegister(id: string, fn: RefreshFn) {
  const ctx = useContext(LavorazioneRefreshContext);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    if (!ctx) return;
    return ctx.register(id, () => fnRef.current());
  }, [ctx, id]);
}

export function LavorazioneAggiornaButton({ className }: { className?: string }) {
  const ctx = useContext(LavorazioneRefreshContext);
  if (!ctx) return null;

  const { refreshAll, refreshing, lastUpdated } = ctx;
  const ora =
    lastUpdated &&
    lastUpdated.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className={`flex items-center gap-2 ${className ?? ""}`}>
      {ora ? (
        <span className="hidden text-[10px] text-[var(--muted)] sm:inline">
          Aggiornato alle {ora}
        </span>
      ) : null}
      <button
        type="button"
        onClick={() => void refreshAll()}
        disabled={refreshing}
        title="Ricalcola totali e pratiche lavorate"
        className="flex h-9 items-center gap-1.5 rounded-lg border border-[var(--line)] bg-white px-3 text-sm font-medium text-[var(--navy)] hover:bg-slate-50 disabled:opacity-50"
      >
        <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
        {refreshing ? "Aggiornamento…" : "Aggiorna dati"}
      </button>
    </div>
  );
}
