"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { PhoneIncoming, X } from "lucide-react";
import {
  INBOUND_CALL_SCREEN_POP,
  INBOUND_CALL_SCREEN_POP_DEMO,
  PENDING_INBOUND_SIM_STORAGE_KEY,
  type InboundCallScreenPopDemoDetail,
  type InboundCallScreenPopDetail,
} from "@/lib/inboundCallScreenPop";
import { buildInboundCallDemoResponse } from "@/lib/telephony/inboundCallDemo";
import type {
  InboundCallLookupResponse,
  InboundCallPraticaMatch,
} from "@/lib/telephony/inboundLookupDto";
import { euro } from "@/lib/domainFormat";

type InboundCallPopItem =
  | { id: string; phase: "loading"; numero: string; demo?: boolean }
  | { id: string; phase: "ready"; numero: string; data: InboundCallLookupResponse; demo?: boolean }
  | { id: string; phase: "error"; numero: string; message: string };

let inboundPopSeq = 0;
function newInboundPopId() {
  inboundPopSeq += 1;
  return `inbound-pop-${Date.now()}-${inboundPopSeq}`;
}

function MatchBody({ match }: { match: InboundCallPraticaMatch }) {
  return (
    <div className="space-y-2 text-sm text-[var(--navy)]">
      <p>
        <span className="text-[var(--muted)]">Cliente</span>
        <br />
        <span className="font-semibold">{match.debitore}</span>
      </p>
      <p>
        <span className="text-[var(--muted)]">Mandato</span>
        <br />
        <span className="font-semibold">
          {match.mandanteCodice}
          {match.mandanteRagioneSociale ? ` · ${match.mandanteRagioneSociale}` : ""}
        </span>
      </p>
      <p>
        <span className="text-[var(--muted)]">Stato operativo</span>
        <br />
        <span
          className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
            match.inLavorazione
              ? "bg-emerald-100 text-emerald-900"
              : match.praticaChiusa
                ? "bg-slate-200 text-slate-700"
                : "bg-amber-100 text-amber-900"
          }`}
        >
          {match.statoLabel}
          {match.inLavorazione ? "" : match.praticaChiusa ? " · chiusa" : " · non in lavorazione"}
        </span>
      </p>
      <div className="grid grid-cols-2 gap-2 rounded border border-[var(--line)] bg-[#f8fafc] px-2 py-1.5 text-xs">
        <div>
          <span className="text-[var(--muted)]">Debito residuo</span>
          <p className="font-mono font-semibold tabular-nums">{euro(match.residuo)}</p>
        </div>
        <div>
          <span className="text-[var(--muted)]">Netto da pagare</span>
          <p className="font-mono font-semibold tabular-nums">
            {euro(match.nettoDaPagare ?? match.residuo)}
          </p>
        </div>
      </div>
    </div>
  );
}

function InboundCallPopCard({
  item,
  onDismiss,
}: {
  item: InboundCallPopItem;
  onDismiss: () => void;
}) {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const { numero } = item;
  const matches = item.phase === "ready" ? item.data.matches : [];
  const active = matches[selectedIdx] ?? matches[0];

  const showApriPratica = item.phase === "ready" && Boolean(active);
  const isDemoPratica = active?.praticaId === "__demo_inbound__";
  const apriClassName =
    "inline-flex h-7 max-w-[9.5rem] items-center justify-center truncate rounded-md bg-white px-2 text-[10px] font-bold uppercase tracking-wide text-[var(--navy)] hover:bg-white/90";

  return (
    <div
      className="flex max-h-[min(420px,55dvh)] w-[min(380px,calc(100vw-2rem))] flex-col overflow-hidden rounded-lg border-2 border-[var(--navy)] bg-white shadow-2xl"
      role="dialog"
      aria-label={`Chiamata in entrata ${numero}`}
    >
      <div className="flex shrink-0 items-center justify-between gap-2 bg-[var(--navy)] px-3 py-2 text-white">
        <div className="flex min-w-0 items-center gap-2">
          <PhoneIncoming className="h-4 w-4 shrink-0" aria-hidden />
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide">
              Chiamata in entrata
              {item.phase === "ready" && item.demo ? " · demo" : ""}
            </p>
            <p className="truncate font-mono text-sm">{numero}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {showApriPratica && active ? (
            isDemoPratica ? (
              <span
                className={`${apriClassName} cursor-default opacity-95`}
                title="Anteprima demo — nessuna scheda reale"
              >
                Apri {active.numero}
              </span>
            ) : (
              <Link
                href={`/pratiche/${active.praticaId}`}
                className={apriClassName}
                title={`Apri pratica ${active.numero}`}
              >
                Apri {active.numero}
              </Link>
            )
          ) : null}
          <button
            type="button"
            onClick={onDismiss}
            className="rounded p-1 hover:bg-white/15"
            aria-label="Chiudi"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {item.phase === "loading" ? (
          <p className="text-sm text-[var(--muted)]">Ricerca pratica collegata…</p>
        ) : null}
        {item.phase === "error" ? (
          <p className="text-sm text-red-700">{item.message}</p>
        ) : null}
        {item.phase === "ready" && !matches.length ? (
          <p className="text-sm text-[var(--muted)]">
            Nessuna pratica trovata per questo numero (debitore o recapiti).
          </p>
        ) : null}
        {item.phase === "ready" && active ? (
          <>
            {matches.length > 1 ? (
              <div className="mb-2 flex flex-wrap gap-1">
                {matches.map((m, i) => (
                  <button
                    key={m.praticaId}
                    type="button"
                    onClick={() => setSelectedIdx(i)}
                    className={`rounded border px-2 py-0.5 font-mono text-[10px] ${
                      i === selectedIdx
                        ? "border-[var(--navy)] bg-[var(--navy)] text-white"
                        : "border-[var(--line)] bg-white text-[var(--navy)]"
                    }`}
                  >
                    {m.numero}
                  </button>
                ))}
              </div>
            ) : null}
            <MatchBody match={active} />
          </>
        ) : null}
      </div>
    </div>
  );
}

function InboundCallScreenPopWatcherInner() {
  const searchParams = useSearchParams();
  const [items, setItems] = useState<InboundCallPopItem[]>([]);
  const lastSimRef = useRef<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  }, []);

  const pushDemo = useCallback((numero: string) => {
    const id = newInboundPopId();
    setItems((prev) => [
      ...prev,
      {
        id,
        phase: "ready",
        numero,
        data: buildInboundCallDemoResponse(numero),
        demo: true,
      },
    ]);
  }, []);

  const enqueueLoad = useCallback(async (numero: string, numeroChiamato?: string) => {
    const id = newInboundPopId();
    setItems((prev) => [...prev, { id, phase: "loading", numero }]);
    try {
      const q = new URLSearchParams({ numero });
      if (numeroChiamato?.trim()) q.set("numeroChiamato", numeroChiamato.trim());
      const res = await fetch(`/api/telephony/inbound-lookup?${q.toString()}`, {
        credentials: "same-origin",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          typeof body.error === "string" ? body.error : "Lookup non riuscito"
        );
      }
      const data = (await res.json()) as InboundCallLookupResponse;
      setItems((prev) =>
        prev.map((it) => (it.id === id ? { id, phase: "ready", numero, data } : it))
      );
    } catch (e) {
      const message = e instanceof Error ? e.message : "Errore di rete";
      setItems((prev) =>
        prev.map((it) => (it.id === id ? { id, phase: "error", numero, message } : it))
      );
    }
  }, []);

  useEffect(() => {
    function onInbound(e: Event) {
      const detail = (e as CustomEvent<InboundCallScreenPopDetail>).detail;
      if (!detail?.numero) return;
      void enqueueLoad(detail.numero, detail.numeroChiamato);
    }
    function onDemo(e: Event) {
      const detail = (e as CustomEvent<InboundCallScreenPopDemoDetail>).detail;
      pushDemo(detail?.numero?.trim() || "3321000274");
    }
    window.addEventListener(INBOUND_CALL_SCREEN_POP, onInbound);
    window.addEventListener(INBOUND_CALL_SCREEN_POP_DEMO, onDemo);
    return () => {
      window.removeEventListener(INBOUND_CALL_SCREEN_POP, onInbound);
      window.removeEventListener(INBOUND_CALL_SCREEN_POP_DEMO, onDemo);
    };
  }, [enqueueLoad, pushDemo]);

  useEffect(() => {
    const fromUrl = searchParams.get("simulateInbound")?.trim();
    if (fromUrl) {
      try {
        sessionStorage.setItem(PENDING_INBOUND_SIM_STORAGE_KEY, fromUrl);
      } catch {
        /* ignore */
      }
    }
    const demoParam = searchParams.get("demoInboundPop");
    if (demoParam === "1" || demoParam === "true") {
      pushDemo(searchParams.get("numero")?.trim() || "3321000274");
      return;
    }

    let sim = fromUrl;
    if (!sim) {
      try {
        sim = sessionStorage.getItem(PENDING_INBOUND_SIM_STORAGE_KEY)?.trim() || "";
      } catch {
        sim = "";
      }
    }
    if (!sim) return;
    if (sim === lastSimRef.current) return;
    lastSimRef.current = sim;
    try {
      sessionStorage.removeItem(PENDING_INBOUND_SIM_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    void enqueueLoad(sim);
  }, [searchParams, enqueueLoad, pushDemo]);

  if (!mounted || items.length === 0) return null;

  const stack = (
    <div
      className="fixed top-4 right-4 z-[200] flex max-h-[calc(100dvh-2rem)] flex-col gap-3 overflow-y-auto print:hidden"
      aria-live="polite"
    >
      {items.map((item) => (
        <InboundCallPopCard
          key={item.id}
          item={item}
          onDismiss={() => dismiss(item.id)}
        />
      ))}
    </div>
  );

  return createPortal(stack, document.body);
}

export function InboundCallScreenPopWatcher() {
  return (
    <Suspense fallback={null}>
      <InboundCallScreenPopWatcherInner />
    </Suspense>
  );
}
