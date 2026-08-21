"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Modal } from "@/components/Modal";
import { NuovoImpegnoAgenda } from "@/components/agenda/AgendaAzioniPanel";
import { CompletaImpegnoButton } from "@/components/agenda/CompletaImpegnoButton";
import { CompletaRichiamoButton } from "@/components/pratica/CompletaRichiamoButton";
import {
  etichettaIntervallo,
  filtraPerIntervallo,
  formatDataAgenda,
  intervalloVista,
  parseDataAgenda,
  parseVistaAgenda,
  spostaAnchor,
  type VistaAgenda,
} from "@/lib/agendaVista";
import { esitoContattoLabel, tipoContattoLabel } from "@/lib/contatto";

export type CalendarioVoceSerialized =
  | {
      kind: "pratica";
      id: string;
      memoAt: string;
      numero: string;
      debitore: string;
      tipoContatto: string | null;
      esitoContatto: string | null;
      assegnatario: string | null;
    }
  | {
      kind: "libero";
      id: string;
      memoAt: string;
      titolo: string;
      nota: string | null;
      autore: string;
    };

function formatOra(iso: string) {
  return new Date(iso).toLocaleString("it-IT", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildHref(vista: VistaAgenda, data: string) {
  const sp = new URLSearchParams();
  sp.set("tab", "calendario");
  if (vista !== "giorno") sp.set("vista", vista);
  if (data !== formatDataAgenda(new Date())) sp.set("data", data);
  const qs = sp.toString();
  return qs ? `/agenda?${qs}` : "/agenda";
}

export function AgendaCalendarioPanel({
  voci,
  vistaRaw,
  dataRaw,
}: {
  voci: CalendarioVoceSerialized[];
  vistaRaw?: string;
  dataRaw?: string;
}) {
  const vista = parseVistaAgenda(vistaRaw);
  const anchor = parseDataAgenda(dataRaw);
  const dataIso = formatDataAgenda(anchor);
  const [nuovoOpen, setNuovoOpen] = useState(false);

  const filtrate = useMemo(() => {
    const { start, end } = intervalloVista(vista, anchor);
    return filtraPerIntervallo(voci, start, end);
  }, [voci, vista, anchor]);

  const prevData = formatDataAgenda(spostaAnchor(vista, anchor, -1));
  const nextData = formatDataAgenda(spostaAnchor(vista, anchor, 1));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2 text-sm">
          {(["giorno", "settimana", "mese"] as const).map((v) => (
            <Link
              key={v}
              href={buildHref(v, dataIso)}
              className={`rounded-lg px-3 py-1.5 capitalize ${
                vista === v ? "bg-[#132033] text-white" : "border border-[var(--line)] bg-white"
              }`}
            >
              {v === "giorno" ? "Giorno" : v === "settimana" ? "Settimana" : "Mese"}
            </Link>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setNuovoOpen(true)}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[var(--navy)] px-3 text-sm font-medium text-white"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Nuovo impegno
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--line)] bg-white px-3 py-2">
        <Link
          href={buildHref(vista, prevData)}
          className="rounded border border-[var(--line)] px-2 py-1 text-sm hover:bg-[#eef4f8]"
          title="Periodo precedente"
        >
          ‹
        </Link>
        <p className="min-w-[10rem] flex-1 text-center text-sm font-semibold capitalize text-[var(--navy)]">
          {etichettaIntervallo(vista, anchor)}
        </p>
        <Link
          href={buildHref(vista, nextData)}
          className="rounded border border-[var(--line)] px-2 py-1 text-sm hover:bg-[#eef4f8]"
          title="Periodo successivo"
        >
          ›
        </Link>
        <Link
          href={buildHref(vista, formatDataAgenda(new Date()))}
          className="text-xs text-[var(--accent)] underline"
        >
          Oggi
        </Link>
      </div>

      <div className="rounded-xl border border-[var(--line)] bg-white">
        <div className="border-b border-[var(--line)] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
          {filtrate.length === 1
            ? "1 impegno nel periodo"
            : `${filtrate.length} impegni nel periodo`}
        </div>
        <ul className="divide-y divide-[var(--line)] text-sm">
          {filtrate.map((voce) =>
            voce.kind === "pratica" ? (
              <li key={`p-${voce.id}`} className="flex flex-wrap items-center justify-between gap-3 px-3 py-3">
                <div>
                  <Link className="font-medium text-[var(--accent)] underline" href={`/pratiche/${voce.id}`}>
                    {voce.numero}
                  </Link>{" "}
                  {voce.debitore}
                  <p className="text-[var(--muted)]">
                    {tipoContattoLabel(voce.tipoContatto)} · {esitoContattoLabel(voce.esitoContatto)}
                  </p>
                  <p className="text-xs text-[var(--muted)]">{voce.assegnatario || "—"}</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-right text-sm">{formatOra(voce.memoAt)}</p>
                  <CompletaRichiamoButton praticaId={voce.id} />
                </div>
              </li>
            ) : (
              <li key={`i-${voce.id}`} className="flex flex-wrap items-center justify-between gap-3 px-3 py-3">
                <div>
                  <p className="font-medium text-[#1a365d]">{voce.titolo}</p>
                  {voce.nota ? <p className="text-[var(--muted)]">{voce.nota}</p> : null}
                  <p className="text-xs text-[var(--muted)]">Impegno libero · {voce.autore}</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-right text-sm">{formatOra(voce.memoAt)}</p>
                  <CompletaImpegnoButton impegnoId={voce.id} />
                </div>
              </li>
            )
          )}
          {!filtrate.length ? (
            <li className="px-3 py-8 text-center text-[var(--muted)]">
              Nessun impegno in questo periodo.
            </li>
          ) : null}
        </ul>
      </div>

      <Modal open={nuovoOpen} title="Nuovo impegno in agenda" onClose={() => setNuovoOpen(false)} wide>
        <NuovoImpegnoAgenda onDone={() => setNuovoOpen(false)} />
      </Modal>
    </div>
  );
}
