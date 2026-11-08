"use client";

import { useCallback, useEffect, useState } from "react";
import { QrCode } from "lucide-react";
import { CollegaCreditCalcButton } from "@/components/creditcalc/CollegaCreditCalcButton";

type OperatorLinkState = {
  linked: boolean;
  connections: {
    connectionId: string;
    tenantName: string;
    createdAt: string;
  }[];
};

function formatCollegamentoQuando(iso: string | undefined): string | null {
  if (!iso?.trim()) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isLocalBffHost(url: string): boolean {
  try {
    const h = new URL(url).hostname.toLowerCase();
    return h === "localhost" || h === "127.0.0.1";
  } catch {
    return false;
  }
}

export function CredixaAppCollegamentoCard() {
  const [state, setState] = useState<OperatorLinkState | null>(null);
  const [bffHint, setBffHint] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [disconnectError, setDisconnectError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/creditcalc/operator-link", {
        cache: "no-store",
      });
      if (!res.ok) return;
      setState((await res.json()) as OperatorLinkState);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refresh]);

  async function scollegaApp() {
    const conns = state?.connections ?? [];
    const label =
      conns.length === 1 && conns[0]?.tenantName
        ? `«${conns[0].tenantName}»`
        : "l’app collegata";
    if (
      !window.confirm(
        `Scollegare CredixaApp da questo operatore (${label})?\n\n` +
          "L’app sul telefono non vedrà più le pratiche finché non generi un nuovo QR."
      )
    ) {
      return;
    }
    setDisconnecting(true);
    setDisconnectError(null);
    try {
      const res = await fetch("/api/creditcalc/operator-link", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          conns.length === 1
            ? { connectionId: conns[0].connectionId }
            : {}
        ),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Scollegamento non riuscito");
      await refresh();
    } catch (e) {
      setDisconnectError(e instanceof Error ? e.message : "Errore");
    } finally {
      setDisconnecting(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-3">
      {state?.linked ? (
        <div className="flex flex-col gap-2">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            App collegata
            {state.connections[0]?.tenantName
              ? ` — ${state.connections[0].tenantName}`
              : ""}
            . Da CredixaApp → Itinerario → Pratiche in affido vedrai le pratiche a
            te affidate.
            {state.connections.map((c) => {
              const quando = formatCollegamentoQuando(c.createdAt);
              if (!quando) return null;
              return (
                <span key={c.connectionId} className="mt-1 block text-emerald-800/90">
                  Collegato il{" "}
                  <span className="font-medium tabular-nums">{quando}</span>
                  {state.connections.length > 1 && c.tenantName
                    ? ` (${c.tenantName})`
                    : null}
                </span>
              );
            })}
          </div>
          <button
            type="button"
            disabled={disconnecting}
            onClick={() => void scollegaApp()}
            className="inline-flex h-9 w-fit items-center rounded border border-red-200 bg-red-50 px-3 text-sm font-medium text-red-900 hover:bg-red-100 disabled:opacity-60"
          >
            {disconnecting ? "Scollegamento…" : "Scollega CredixaApp"}
          </button>
          {disconnectError ? (
            <p className="text-sm text-[var(--danger)]">{disconnectError}</p>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-[var(--muted)]">
          Nessun collegamento attivo. Genera un QR e scansionalo dall’app.
        </p>
      )}

      <p className="text-sm leading-relaxed text-[var(--muted)]">
        Da CredixaApp: menu{" "}
        <span className="font-medium text-[var(--navy)]">Aziende</span> (o
        Impostazioni → Collegamenti gestionale)
        . Il QR contiene l’indirizzo del gestionale: l’app lo memorizza e usa il
        tuo profilo operatore.
      </p>

      {bffHint && isLocalBffHost(bffHint) ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-950">
          Il server risulta <span className="font-mono">{bffHint}</span>: dal
          telefono non è raggiungibile. Imposta{" "}
          <span className="font-mono">CREDIXA_BFF_PUBLIC_URL</span> con l’IP LAN
          del PC (es. <span className="font-mono">http://192.168.x.x:3100</span>
          ) e rigenera il QR. Non serve pubblicare su Internet se telefono e PC sono sulla
          stessa Wi‑Fi.
        </div>
      ) : null}

      <CollegaCreditCalcButton
        label="Genera QR collegamento"
        onBffBaseUrl={setBffHint}
        onLinkConsumed={refresh}
      />

      <p className="text-[11px] text-[var(--muted)]">
        <QrCode className="mr-1 inline h-3 w-3" aria-hidden />
        Dopo il collegamento l’app mostra pratiche in affido, scheda, note e
        codice scarico secondo i permessi CredixaApp del tuo utente.
      </p>
    </div>
  );
}
