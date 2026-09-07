"use client";

import { useEffect, useState } from "react";
import { ContabilePreviewPanel } from "@/components/pratica/ContabilePreviewPanel";
import { RegistroNote } from "@/components/pratica/RegistroNote";
import { formatNotaLine } from "@/lib/noteFormat";
import {
  fetchPraticaExtra,
  PRATICA_EXTRA_INVALIDATE_EVENT,
  type PraticaExtraPayload,
} from "@/lib/praticaExtraClient";

type Debitore = {
  ndg?: string | null;
  codiceFiscale?: string | null;
  nome: string;
  cognome: string;
  telefono?: string | null;
  indirizzo?: string | null;
  citta?: string | null;
  cap?: string | null;
  provincia?: string | null;
};

type NotaStreamPayload = {
  attivita: PraticaExtraPayload["attivita"];
};

export function ContabilePreviewLazy({
  praticaId,
  canEditFatture,
  canEditIncassi,
  debitore,
  numero,
  creditore,
  societa,
  scadenza,
  affidato,
  definito,
}: {
  praticaId: string;
  canEditFatture?: boolean;
  canEditIncassi?: boolean;
  debitore: Debitore;
  numero: string;
  creditore: string;
  societa: string;
  scadenza: Date | null;
  affidato: number;
  definito: number;
}) {
  const [extra, setExtra] = useState<PraticaExtraPayload | null>(null);
  const [pending, setPending] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setPending(true);
    fetchPraticaExtra(praticaId, { force: true }).then((data) => {
      if (cancelled) return;
      if (data) setExtra(data);
      setPending(false);
    });

    function onInvalidate(ev: Event) {
      const detail = (ev as CustomEvent<{ praticaId?: string | null }>).detail;
      if (detail?.praticaId && detail.praticaId !== praticaId) return;
      fetchPraticaExtra(praticaId, { force: true }).then((data) => {
        if (cancelled) return;
        if (data) setExtra(data);
      });
    }
    window.addEventListener(PRATICA_EXTRA_INVALIDATE_EVENT, onInvalidate);

    return () => {
      cancelled = true;
      window.removeEventListener(PRATICA_EXTRA_INVALIDATE_EVENT, onInvalidate);
    };
  }, [praticaId]);

  const fatture = (extra?.fatture || []).map((f) => ({
    ...f,
    dataFattura: new Date(f.dataFattura),
    dataScadenza: new Date(f.dataScadenza),
  }));
  const incassi = (extra?.incassi || []).map((i) => ({
    ...i,
    data: new Date(i.data),
    dataScadenza: i.dataScadenza ? new Date(i.dataScadenza) : null,
  }));

  return (
    <div className="relative flex min-h-[200px] min-w-0 flex-col lg:col-span-4 lg:h-0 lg:min-h-full">
      {pending ? (
        <div className="absolute right-1 top-1 z-10 rounded bg-[#1a4f7a]/85 px-1.5 py-0.5 text-[9px] font-semibold text-white">
          …
        </div>
      ) : null}
      <ContabilePreviewPanel
        praticaId={praticaId}
        canEditFatture={canEditFatture}
        canEditIncassi={canEditIncassi}
        debitore={debitore}
        numero={numero}
        creditore={creditore}
        societa={societa}
        scadenza={scadenza}
        fatture={fatture}
        incassi={[...incassi].sort(
          (a, b) => a.data.getTime() - b.data.getTime()
        )}
        incassiRegistrati={incassi}
        affidato={affidato}
        definito={definito}
      />
    </div>
  );
}

export function RegistroNoteLazy({
  praticaId,
  canEdit,
  canSblocca,
}: {
  praticaId: string;
  canEdit: boolean;
  canSblocca?: boolean;
}) {
  const [extra, setExtra] = useState<PraticaExtraPayload | null>(null);
  const [pending, setPending] = useState(true);
  const [live, setLive] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let es: EventSource | null = null;
    let fallbackTimer: number | undefined;

    async function loadOnce(showPending: boolean) {
      if (showPending) setPending(true);
      const data = await fetchPraticaExtra(praticaId, { force: true });
      if (cancelled) return;
      // Non azzerare le note già visibili se una fetch fallisce.
      if (data) setExtra(data);
      setPending(false);
    }

    void loadOnce(true);

    const streamUrl = `/api/pratiche/${encodeURIComponent(praticaId)}/notes/stream`;
    try {
      es = new EventSource(streamUrl);
      es.addEventListener("notes", (ev) => {
        if (cancelled) return;
        try {
          const payload = JSON.parse(
            (ev as MessageEvent).data
          ) as NotaStreamPayload;
          if (!Array.isArray(payload.attivita)) return;
          setLive(true);
          setExtra((prev) => ({
            attivita: payload.attivita,
            incassi: prev?.incassi || [],
            fatture: prev?.fatture || [],
          }));
          setPending(false);
        } catch {
          /* ignore parse */
        }
      });
      es.onerror = () => {
        setLive(false);
        // Fallback polling se lo stream cade
        if (fallbackTimer == null) {
          fallbackTimer = window.setInterval(() => {
            void loadOnce(false);
          }, 1000);
        }
      };
      es.onopen = () => {
        setLive(true);
        if (fallbackTimer != null) {
          window.clearInterval(fallbackTimer);
          fallbackTimer = undefined;
        }
      };
    } catch {
      fallbackTimer = window.setInterval(() => {
        void loadOnce(false);
      }, 1000);
    }

    function onVisible() {
      if (document.visibilityState === "visible") void loadOnce(false);
    }
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    return () => {
      cancelled = true;
      es?.close();
      if (fallbackTimer != null) window.clearInterval(fallbackTimer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [praticaId]);

  const attivita = [...(extra?.attivita || [])]
    .sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )
    .map((a) => ({
      id: a.id,
      line: formatNotaLine({
        userName: a.user?.name || "Operatore",
        createdAt: new Date(a.createdAt),
        tipo: a.tipo,
        esito: a.esito,
        nota: a.nota,
      }),
      tipo: a.tipo,
      esito: a.esito,
      nota: a.nota,
      fissata: Boolean(a.fissata),
      importante: Boolean(a.importante),
      bloccata: Boolean(a.bloccata),
    }));

  return (
    <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
      {pending ? (
        <div className="pointer-events-none absolute right-2 top-1 z-10 rounded bg-[#1a4f7a]/85 px-1.5 py-0.5 text-[9px] font-semibold text-white">
          Caricamento note…
        </div>
      ) : live ? (
        <div
          className="pointer-events-none absolute right-2 top-1 z-10 rounded bg-emerald-700/85 px-1.5 py-0.5 text-[9px] font-semibold text-white"
          title="Aggiornamento note in tempo reale"
        >
          live
        </div>
      ) : null}
      <RegistroNote
        praticaId={praticaId}
        attivita={attivita}
        canEdit={canEdit}
        canSblocca={canSblocca}
      />
    </div>
  );
}
