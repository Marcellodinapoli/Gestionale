"use client";

import { useState } from "react";
import { mostraDemoInboundScreenPop, notificaChiamataEntrante } from "@/lib/inboundCallScreenPop";

/** Solo sviluppo: simula inbound senza centralino. */
export function InboundCallSimulatePanel() {
  if (process.env.NODE_ENV === "production") return null;

  const [numero, setNumero] = useState("3321000274");

  return (
    <div className={sectionCls}>
      <div className={headerCls}>Simulazione chiamata in entrata</div>
      <div className="space-y-2 p-3 text-sm">
        <p className="text-xs text-[var(--muted)]">
          Inserisci un numero presente su debitore/recapiti e premi Simula: compare il popup in alto
          a destra (come per un inbound reale via evento{" "}
          <code className="text-[10px]">gestionale:inbound-call-screen-pop</code>).
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs">
            <span className="mb-1 block font-semibold text-[var(--muted)]">Numero</span>
            <input
              type="tel"
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
              placeholder="es. 3331234567"
              className="min-w-[180px] rounded border border-[var(--line)] px-2 py-1.5 font-mono text-sm"
            />
          </label>
          <button
            type="button"
            onClick={() => mostraDemoInboundScreenPop(numero)}
            className="h-8 rounded-lg border-2 border-[var(--navy)] bg-white px-3 text-xs font-semibold text-[var(--navy)]"
          >
            Anteprima demo
          </button>
          <button
            type="button"
            disabled={numero.trim().length < 3}
            onClick={() => notificaChiamataEntrante(numero)}
            className="h-8 rounded-lg bg-[var(--navy)] px-3 text-xs font-semibold text-white disabled:opacity-50"
          >
            Lookup reale
          </button>
        </div>
        <p className="text-[10px] text-[var(--muted)]">
          In qualsiasi pagina (dev): pulsante <strong>Demo popup inbound</strong> in basso a
          destra. URL: <code className="font-mono">?demoInboundPop=1</code> o{" "}
          <code className="font-mono">?simulateInbound=NUMERO</code> (il numero resta dopo il
          login).
        </p>
      </div>
    </div>
  );
}

const sectionCls =
  "rounded-lg border border-dashed border-amber-400 bg-amber-50/50 overflow-hidden";
const headerCls =
  "bg-amber-100 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-amber-900";
