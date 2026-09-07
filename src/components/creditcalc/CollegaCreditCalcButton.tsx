"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/Modal";
import { QrCode } from "lucide-react";

type LinkCreateResponse = {
  linkRequestId: string;
  qrPayload: string;
  expiresAt: string;
  status: string;
  operatorName: string;
  tenantName: string;
};

type LinkStatusResponse = {
  linkRequestId: string;
  status: string;
  expiresAt: string;
  operatorName?: string;
  tenantName?: string;
};

function qrImageUrl(payload: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(payload)}`;
}

function secondsLeft(expiresAt: string) {
  return Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
}

export function CollegaCreditCalcButton({
  gestionaleUserId,
  label = "Collega CreditCalc",
  className,
}: {
  /** Se assente, QR per l’utente autenticato. */
  gestionaleUserId?: string;
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<LinkCreateResponse | null>(null);
  const [status, setStatus] = useState<string>("pending");
  const [tick, setTick] = useState(0);

  const remaining = useMemo(() => {
    if (!link) return 0;
    void tick;
    return secondsLeft(link.expiresAt);
  }, [link, tick]);

  const reset = useCallback(() => {
    setLink(null);
    setStatus("pending");
    setError(null);
    setPending(false);
  }, []);

  async function createLink() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/creditcalc/link-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          gestionaleUserId ? { gestionaleUserId } : {}
        ),
      });
      const data = (await res.json()) as LinkCreateResponse & { error?: string };
      if (!res.ok) throw new Error(data.error || "Errore generazione QR");
      setLink(data);
      setStatus(data.status);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore");
    } finally {
      setPending(false);
    }
  }

  async function revoke() {
    if (!link) return;
    setPending(true);
    try {
      await fetch(`/api/creditcalc/link-requests/${encodeURIComponent(link.linkRequestId)}`, {
        method: "DELETE",
      });
      setStatus("revoked");
    } catch {
      setError("Revoca non riuscita");
    } finally {
      setPending(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    reset();
    void createLink();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, gestionaleUserId]);

  useEffect(() => {
    if (!open || !link || status !== "pending") return;
    const t = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(t);
  }, [open, link, status]);

  useEffect(() => {
    if (!open || !link || status !== "pending") return;
    const poll = window.setInterval(async () => {
      try {
        const res = await fetch(
          `/api/creditcalc/link-requests/${encodeURIComponent(link.linkRequestId)}`
        );
        if (!res.ok) return;
        const data = (await res.json()) as LinkStatusResponse;
        setStatus(data.status);
      } catch {
        /* ignore */
      }
    }, 2000);
    return () => window.clearInterval(poll);
  }, [open, link, status]);

  useEffect(() => {
    if (status === "pending" && link && remaining <= 0) {
      setStatus("expired");
    }
  }, [remaining, status, link]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          className ||
          "inline-flex h-9 items-center gap-1.5 rounded border border-[#1a4f7a] bg-[#e8f1f8] px-3 text-xs font-semibold text-[#123a5c] hover:bg-[#d4e6f4]"
        }
      >
        <QrCode className="h-3.5 w-3.5" />
        {label}
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Collega CreditCalc"
      >
        <div className="space-y-4 p-1">
          <p className="text-sm text-[var(--muted)]">
            L’operatore apre CreditCalc → Impostazioni → Collegamenti e scansiona
            questo QR. Il codice è temporaneo e monouso.
          </p>

          {error ? (
            <p className="text-sm text-[var(--danger)]">{error}</p>
          ) : null}

          {pending && !link ? (
            <p className="text-sm text-[var(--muted)]">Generazione QR…</p>
          ) : null}

          {link && status === "pending" ? (
            <div className="flex flex-col items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrImageUrl(link.qrPayload)}
                alt="QR collegamento CreditCalc"
                width={240}
                height={240}
                className="rounded border border-[var(--line)] bg-white p-2"
              />
              <p className="text-center text-sm font-medium text-[var(--navy)]">
                {link.tenantName}
                <br />
                <span className="font-normal text-[var(--muted)]">
                  Operatore: {link.operatorName}
                </span>
              </p>
              <p className="font-mono text-lg font-semibold tabular-nums text-[#1a4f7a]">
                {Math.floor(remaining / 60)}:
                {String(remaining % 60).padStart(2, "0")}
              </p>
              <p className="text-center text-[11px] text-[var(--muted)]">
                In attesa della scansione sull’app…
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    reset();
                    void createLink();
                  }}
                  className="h-9 rounded border border-[var(--line)] bg-white px-3 text-sm hover:bg-[#eef4f8]"
                >
                  Nuovo QR
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => void revoke()}
                  className="h-9 rounded border border-red-200 bg-red-50 px-3 text-sm text-red-800 hover:bg-red-100"
                >
                  Revoca
                </button>
              </div>
            </div>
          ) : null}

          {status === "consumed" ? (
            <div className="rounded border border-emerald-200 bg-emerald-50 p-4 text-center text-sm text-emerald-900">
              Collegamento completato. L’app è ora associata a questo operatore.
            </div>
          ) : null}

          {status === "expired" ? (
            <div className="space-y-3 text-center">
              <p className="text-sm text-amber-800">QR scaduto.</p>
              <button
                type="button"
                onClick={() => {
                  reset();
                  void createLink();
                }}
                className="h-9 rounded bg-[var(--navy)] px-4 text-sm text-white"
              >
                Genera nuovo QR
              </button>
            </div>
          ) : null}

          {status === "revoked" ? (
            <div className="space-y-3 text-center">
              <p className="text-sm text-[var(--muted)]">QR revocato.</p>
              <button
                type="button"
                onClick={() => {
                  reset();
                  void createLink();
                }}
                className="h-9 rounded bg-[var(--navy)] px-4 text-sm text-white"
              >
                Genera nuovo QR
              </button>
            </div>
          ) : null}
        </div>
      </Modal>
    </>
  );
}
