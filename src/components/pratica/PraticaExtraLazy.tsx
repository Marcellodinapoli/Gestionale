"use client";

import { useEffect, useState } from "react";
import { ContabilePreviewPanel } from "@/components/pratica/ContabilePreviewPanel";
import { RegistroNote } from "@/components/pratica/RegistroNote";
import { formatNotaLine } from "@/lib/noteFormat";
import { fetchPraticaExtra, type PraticaExtraPayload } from "@/lib/praticaExtraClient";

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

export function ContabilePreviewLazy({
  praticaId,
  canEditFatture,
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
    fetchPraticaExtra(praticaId).then((data) => {
      if (cancelled) return;
      setExtra(data);
      setPending(false);
    });
    return () => {
      cancelled = true;
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

  useEffect(() => {
    let cancelled = false;
    setPending(true);
    fetchPraticaExtra(praticaId).then((data) => {
      if (cancelled) return;
      setExtra(data);
      setPending(false);
    });
    return () => {
      cancelled = true;
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
        userName: a.user.name,
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
