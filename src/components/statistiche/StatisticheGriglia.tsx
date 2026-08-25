"use client";

import { Fragment } from "react";
import type { StatisticheRiga, StatisticheSezione } from "@/lib/statisticheGruppo";
import { fmtPct } from "@/lib/scarico";
import { fmtImportoTabella } from "@/lib/statisticheGruppo";

function Cell({
  children,
  right,
  bold,
  muted,
}: {
  children: React.ReactNode;
  right?: boolean;
  bold?: boolean;
  muted?: boolean;
}) {
  return (
    <td
      className={`border border-[#b8c4d0] px-1.5 py-0.5 font-mono text-[11px] leading-5 whitespace-nowrap ${
        right ? "text-right" : "text-left"
      } ${bold ? "bg-[#eef2f6] font-bold" : "bg-white"} ${muted ? "text-[var(--muted)]" : "text-[#132033]"}`}
    >
      {children}
    </td>
  );
}

function importoCell(value: number, nascondiImporti: boolean) {
  if (nascondiImporti) return "—";
  return fmtImportoTabella(value);
}

function Riga({
  riga,
  nascondiImporti,
}: {
  riga: StatisticheRiga;
  nascondiImporti: boolean;
}) {
  return (
    <tr className={riga.isTotale ? "outline outline-2 outline-[#132033]" : ""}>
      <Cell bold={riga.isTotale}>{riga.esa}</Cell>
      <Cell>{riga.mandato}</Cell>
      <Cell>{riga.lottoCg}</Cell>
      <Cell right>{riga.nrPrt}</Cell>
      <Cell right muted={nascondiImporti}>
        {importoCell(riga.affidato, nascondiImporti)}
      </Cell>
      <Cell right muted={nascondiImporti}>
        {importoCell(riga.incassato, nascondiImporti)}
      </Cell>
      <Cell right>{riga.nrPzInc}</Cell>
      <Cell right muted={nascondiImporti}>
        {nascondiImporti ? "—" : fmtPct(riga.pctPzIncAffidato)}
      </Cell>
      <Cell right muted>
        {fmtPct(riga.pctPzIncPezzi)}
      </Cell>
      {riga.scarichi.map((s) => (
        <FragmentRow key={s.codice} scarico={s} nascondiImporti={nascondiImporti} />
      ))}
    </tr>
  );
}

function FragmentRow({
  scarico,
  nascondiImporti,
}: {
  scarico: StatisticheRiga["scarichi"][number];
  nascondiImporti: boolean;
}) {
  return (
    <>
      <Cell right muted={nascondiImporti}>
        {importoCell(scarico.importo, nascondiImporti)}
      </Cell>
      <Cell right>{scarico.nr}</Cell>
      <Cell right muted={nascondiImporti}>
        {nascondiImporti ? "—" : fmtPct(scarico.pctAffidato)}
      </Cell>
      <Cell right muted>
        {fmtPct(scarico.pctPezzi)}
      </Cell>
    </>
  );
}

function Intestazione() {
  const th =
    "border border-[#b8c4d0] bg-white px-1.5 py-1 text-center text-[10px] font-bold uppercase leading-tight text-[#132033]";
  return (
    <thead>
      <tr>
        <th className={th} rowSpan={2}>
          Esa
        </th>
        <th className={th} rowSpan={2}>
          Mandato
        </th>
        <th className={th} rowSpan={2}>
          Perimetro
        </th>
        <th className={th} rowSpan={2}>
          Nr Prt
        </th>
        <th className={th} rowSpan={2}>
          Affidato
        </th>
        <th className={th} rowSpan={2}>
          Incassato
        </th>
        <th className={th} rowSpan={2}>
          Nr Pz Inc
        </th>
        <th className={th} colSpan={2}>
          % Pz Inc
        </th>
        <th className={th} colSpan={4}>
          N/D
        </th>
        <th className={th} colSpan={4}>
          PTC
        </th>
        <th className={th} colSpan={4}>
          PPC
        </th>
        <th className={th} colSpan={4}>
          MOV
        </th>
        <th className={th} colSpan={4}>
          LPP
        </th>
        <th className={th} colSpan={4}>
          LPT
        </th>
      </tr>
      <tr>
        <th className={th}>% Aff.</th>
        <th className={th}>% Pz</th>
        {["N/D", "PTC", "PPC", "MOV", "LPP", "LPT"].map((code) => (
          <Fragment key={code}>
            <th className={th}>{code}</th>
            <th className={th}>Nr.</th>
            <th className={th}>% Aff.</th>
            <th className={th}>% Pz</th>
          </Fragment>
        ))}
      </tr>
    </thead>
  );
}

export function StatisticheGriglia({
  sezioni,
  totale,
  dataReport,
  affidoDa,
  affidoA,
  mostraTotaliAzienda = true,
  nascondiImporti = false,
}: {
  sezioni: StatisticheSezione[];
  totale: StatisticheRiga;
  dataReport: string;
  affidoDa: string;
  affidoA: string;
  mostraTotaliAzienda?: boolean;
  /** Nasconde affidato/incassato e importi correlati (Amministrazione fuori dalla propria sede). */
  nascondiImporti?: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded border border-[#b8c4d0] bg-[#f5f7fa] px-3 py-2 text-xs text-[#132033]">
        <span>
          <span className="font-semibold">Data:</span> {dataReport}
        </span>
        <span className="hidden text-[var(--muted)] sm:inline">|</span>
        <span>
          <span className="font-semibold">Affido / Scadenza:</span> {affidoDa} — {affidoA}
        </span>
      </div>

      {sezioni.map((sez) => (
        <div
          key={sez.perimetro}
          className="overflow-auto rounded border border-[#b8c4d0] bg-white shadow-sm"
        >
          <div className="border-b border-[#b8c4d0] bg-[#e8eef4] px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-[#132033]">
            Perimetro {sez.perimetro}
          </div>
          <table className="w-full min-w-[1200px] border-collapse">
            <Intestazione />
            <tbody>
              {sez.righe.map((riga, i) => (
                <Riga
                  key={`${riga.esa}-${riga.mandato}-${riga.lottoCg}-${i}`}
                  riga={riga}
                  nascondiImporti={nascondiImporti}
                />
              ))}
              {!sez.righe.length ? (
                <tr>
                  <td
                    colSpan={30}
                    className="border border-[#b8c4d0] bg-white px-3 py-4 text-center text-xs text-[var(--muted)]"
                  >
                    Nessuna pratica nel periodo · tutti gli operatori del gruppo
                  </td>
                </tr>
              ) : null}
              <Riga riga={sez.subtotale} nascondiImporti={nascondiImporti} />
            </tbody>
          </table>
        </div>
      ))}

      {mostraTotaliAzienda && sezioni.length > 1 ? (
        <div className="overflow-auto rounded border-2 border-[#132033] bg-white shadow-sm">
          <div className="border-b border-[#132033] bg-[#132033] px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-white">
            Totale agenzia · tutti i perimetri
          </div>
          <table className="w-full min-w-[1200px] border-collapse">
            <Intestazione />
            <tbody>
              <Riga riga={totale} nascondiImporti={nascondiImporti} />
            </tbody>
          </table>
        </div>
      ) : null}

      <p className="text-[10px] text-[var(--muted)]">
        % Aff. = percentuale importo su affidato · % Pz = percentuale pezzi su Nr Prt · N/D = senza
        codice scarico (non ancora lavorate). Ogni perimetro ha il proprio subtotale.
      </p>
    </div>
  );
}
