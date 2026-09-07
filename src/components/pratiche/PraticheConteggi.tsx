"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type PraticheConteggiState = {
  totale: number;
  selezionate: number;
  scopeTotal: number;
  setSelezionate: (n: number, scopeTotal: number) => void;
};

const PraticheConteggiContext = createContext<PraticheConteggiState | null>(null);

export function PraticheConteggiProvider({
  totale,
  children,
}: {
  totale: number;
  children: ReactNode;
}) {
  const [selezionate, setSel] = useState(0);
  const [scopeTotal, setScope] = useState(totale);

  const setSelezionate = useCallback((n: number, scope: number) => {
    setSel(n);
    setScope(scope);
  }, []);

  const value = useMemo(
    () => ({ totale, selezionate, scopeTotal, setSelezionate }),
    [totale, selezionate, scopeTotal, setSelezionate]
  );

  return (
    <PraticheConteggiContext.Provider value={value}>
      {children}
    </PraticheConteggiContext.Provider>
  );
}

/** Sottotitolo sotto «Pratiche»: visibili + selezionate. */
export function PraticheConteggiSubtitle({
  showSelezione,
  fallback,
}: {
  showSelezione?: boolean;
  fallback?: string;
}) {
  const ctx = useContext(PraticheConteggiContext);
  if (!ctx) return fallback ?? null;
  if (!showSelezione) return `${ctx.totale} visibili`;
  return `${ctx.totale} visibili · ${ctx.selezionate}/${ctx.scopeTotal || ctx.totale} selezionate`;
}

export function useReportPraticheSelezione(selectedCount: number, scopeTotal: number) {
  const setSelezionate = useContext(PraticheConteggiContext)?.setSelezionate;
  useEffect(() => {
    setSelezionate?.(selectedCount, scopeTotal);
  }, [selectedCount, scopeTotal, setSelezionate]);
}
