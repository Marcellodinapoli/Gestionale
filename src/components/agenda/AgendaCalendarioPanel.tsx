"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Modal } from "@/components/Modal";
import { NuovoImpegnoAgenda } from "@/components/agenda/AgendaAzioniPanel";
import { CompletaImpegnoButton } from "@/components/agenda/CompletaImpegnoButton";
import { SegnaPraticaAgendaLettoButton } from "@/components/agenda/SegnaLettoButton";
import { CompletaRichiamoButton } from "@/components/pratica/CompletaRichiamoButton";
import {
  etichettaIntervallo,
  filtraPerIntervallo,
  formatDataAgenda,
  giorniSettimana,
  GIORNI_SETTIMANA_LABEL,
  grigliaMese,
  intervalloVista,
  chiaveGiorno,
  parseDataAgenda,
  parseVistaAgenda,
  raggruppaPerGiorno,
  stessoGiorno,
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

function formatOraBreve(iso: string) {
  return new Date(iso).toLocaleTimeString("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatOraLunga(iso: string) {
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
  if (vista !== "mese") sp.set("vista", vista);
  if (data !== formatDataAgenda(new Date())) sp.set("data", data);
  const qs = sp.toString();
  return qs ? `/agenda?${qs}` : "/agenda";
}

function etichettaVoce(voce: CalendarioVoceSerialized) {
  if (voce.kind === "pratica") return `${voce.numero} · ${voce.debitore}`;
  return voce.titolo;
}

function VoceChip({
  voce,
  compact,
}: {
  voce: CalendarioVoceSerialized;
  compact?: boolean;
}) {
  const ora = formatOraBreve(voce.memoAt);
  const label = etichettaVoce(voce);
  if (voce.kind === "pratica") {
    return (
      <Link
        href={`/pratiche/${voce.id}`}
        className={`block truncate rounded px-1 py-0.5 text-[10px] font-medium leading-tight text-[var(--navy)] hover:bg-white/80 ${
          compact ? "bg-[#dbeafe]" : "bg-[#bfdbfe]"
        }`}
        title={`${ora} · ${label}`}
      >
        <span className="tabular-nums text-[var(--muted)]">{ora}</span> {label}
      </Link>
    );
  }
  return (
    <span
      className={`block truncate rounded px-1 py-0.5 text-[10px] font-medium leading-tight text-[#1a365d] ${
        compact ? "bg-[#e0e7ff]" : "bg-[#c7d2fe]"
      }`}
      title={`${ora} · ${label}`}
    >
      <span className="tabular-nums text-[var(--muted)]">{ora}</span> {label}
    </span>
  );
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
  const oggi = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const filtrate = useMemo(() => {
    const { start, end } = intervalloVista(vista, anchor);
    return filtraPerIntervallo(voci, start, end);
  }, [voci, vista, anchor]);

  const perGiorno = useMemo(() => raggruppaPerGiorno(filtrate), [filtrate]);

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

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <div className="min-w-0">
          {vista === "mese" ? (
            <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-white">
              <div className="grid grid-cols-7 border-b border-[var(--line)] bg-[#e8eef4] text-center text-[10px] font-bold uppercase tracking-wide text-[var(--navy)]">
                {GIORNI_SETTIMANA_LABEL.map((g) => (
                  <div key={g} className="px-0.5 py-1.5">
                    {g}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 auto-rows-fr">
                {grigliaMese(anchor).map((day) => {
                  const key = chiaveGiorno(day);
                  const items = perGiorno.get(key) ?? [];
                  const inMese = day.getMonth() === anchor.getMonth();
                  const isOggi = stessoGiorno(day, oggi);
                  const isSel = stessoGiorno(day, anchor);
                  return (
                    <div
                      key={key}
                      className={`min-h-[4.25rem] border-b border-r border-[var(--line)] p-1 ${
                        !inMese ? "bg-[#fafbfc] text-[var(--muted)]" : "bg-white"
                      } ${isSel ? "ring-2 ring-inset ring-[var(--accent)]" : ""}`}
                    >
                      <Link
                        href={buildHref("giorno", key)}
                        className={`mb-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold hover:opacity-80 ${
                          isOggi
                            ? "bg-[var(--navy)] text-white"
                            : inMese
                              ? "text-[var(--navy)]"
                              : "text-[var(--muted)]"
                        }`}
                      >
                        {day.getDate()}
                      </Link>
                      <div className="space-y-0.5">
                        {items.slice(0, 2).map((voce) => (
                          <VoceChip
                            key={`${voce.kind}-${voce.id}`}
                            voce={voce}
                            compact
                          />
                        ))}
                        {items.length > 2 ? (
                          <Link
                            href={buildHref("giorno", key)}
                            className="block px-0.5 text-[10px] font-semibold text-[var(--muted)] hover:underline"
                          >
                            +{items.length - 2}
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          {vista === "settimana" ? (
            <div className="overflow-x-auto rounded-xl border border-[var(--line)] bg-white">
              <div className="grid min-w-[420px] grid-cols-7 divide-x divide-[var(--line)]">
                {giorniSettimana(anchor).map((day, i) => {
                  const key = chiaveGiorno(day);
                  const items = perGiorno.get(key) ?? [];
                  const isOggi = stessoGiorno(day, oggi);
                  return (
                    <div key={key} className="min-h-[14rem] bg-white">
                      <Link
                        href={buildHref("giorno", key)}
                        className={`block border-b border-[var(--line)] px-1 py-1.5 text-center hover:bg-[#f8fafc] ${
                          isOggi ? "bg-[#e8eef4]" : "bg-[#f8fafc]"
                        }`}
                      >
                        <p className="text-[9px] font-bold uppercase tracking-wide text-[var(--muted)]">
                          {GIORNI_SETTIMANA_LABEL[i]}
                        </p>
                        <p
                          className={`mx-auto mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                            isOggi ? "bg-[var(--navy)] text-white" : "text-[var(--navy)]"
                          }`}
                        >
                          {day.getDate()}
                        </p>
                      </Link>
                      <div className="space-y-1 p-1">
                        {items.length ? (
                          items.map((voce) => (
                            <VoceChip key={`${voce.kind}-${voce.id}`} voce={voce} compact />
                          ))
                        ) : (
                          <p className="px-1 py-4 text-center text-[10px] text-[var(--muted)]">—</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          {vista === "giorno" ? (
            <div className="rounded-xl border border-[var(--line)] bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                {stessoGiorno(anchor, oggi) ? "Oggi" : etichettaIntervallo("giorno", anchor)}
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-[var(--navy)]">
                {filtrate.length}
              </p>
              <p className="text-sm text-[var(--muted)]">
                {filtrate.length === 1 ? "impegno" : "impegni"} in elenco a destra
              </p>
            </div>
          ) : null}
        </div>

        <div className="min-w-0 rounded-xl border border-[var(--line)] bg-white lg:sticky lg:top-2">
          <div className="border-b border-[var(--line)] bg-[#e8eef4] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--navy)]">
            Impegni · {filtrate.length}{" "}
            {filtrate.length === 1 ? "impegno" : "impegni"}
          </div>
          <ul className="max-h-[min(70vh,36rem)] divide-y divide-[var(--line)] overflow-y-auto text-sm">
            {filtrate.map((voce) =>
              voce.kind === "pratica" ? (
                <li
                  key={`list-p-${voce.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/pratiche/${voce.id}`}
                      className="font-medium text-[var(--accent)] underline"
                    >
                      {voce.numero}
                    </Link>{" "}
                    {voce.debitore}
                    {voce.assegnatario ? (
                      <p className="text-xs text-[var(--muted)]">
                        Affidata a: {voce.assegnatario}
                      </p>
                    ) : null}
                    {vista === "giorno" ? (
                      <p className="text-[var(--muted)]">
                        {tipoContattoLabel(voce.tipoContatto)} ·{" "}
                        {esitoContattoLabel(voce.esitoContatto)}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="text-right text-sm tabular-nums">
                      {vista === "giorno"
                        ? formatOraBreve(voce.memoAt)
                        : formatOraLunga(voce.memoAt)}
                    </p>
                    <SegnaPraticaAgendaLettoButton praticaId={voce.id} />
                    <CompletaRichiamoButton praticaId={voce.id} />
                  </div>
                </li>
              ) : (
                <li
                  key={`list-i-${voce.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-[#1a365d]">{voce.titolo}</p>
                    {voce.nota ? <p className="text-[var(--muted)]">{voce.nota}</p> : null}
                    <p className="text-xs text-[var(--muted)]">Impegno libero · {voce.autore}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="text-right text-sm tabular-nums">
                      {vista === "giorno"
                        ? formatOraBreve(voce.memoAt)
                        : formatOraLunga(voce.memoAt)}
                    </p>
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
      </div>

      <Modal open={nuovoOpen} title="Nuovo impegno in agenda" onClose={() => setNuovoOpen(false)} wide>
        <NuovoImpegnoAgenda onDone={() => setNuovoOpen(false)} />
      </Modal>
    </div>
  );
}
