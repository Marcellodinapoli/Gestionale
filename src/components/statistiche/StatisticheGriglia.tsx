"use client";

import { Fragment } from "react";
import type { StatisticheRiga } from "@/lib/statisticheGruppo";
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

function Riga({ riga }: { riga: StatisticheRiga }) {
  return (
    <tr className={riga.isTotale ? "outline outline-2 outline-[#132033]" : ""}>
      <Cell bold={riga.isTotale}>{riga.esa}</Cell>
      <Cell>{riga.mandato}</Cell>
      <Cell>{riga.lottoCg}</Cell>
      <Cell right>{riga.nrPrt}</Cell>
      <Cell right>{fmtImportoTabella(riga.affidato)}</Cell>
      <Cell right>{fmtImportoTabella(riga.incassato)}</Cell>
      <Cell right>{riga.nrPzInc}</Cell>
      <Cell right>{fmtPct(riga.pctPzIncAffidato)}</Cell>
      <Cell right muted>
        {fmtPct(riga.pctPzIncPezzi)}
      </Cell>
      {riga.scarichi.map((s) => (
        <FragmentRow key={s.codice} scarico={s} />
      ))}
    </tr>
  );
}

function FragmentRow({
  scarico,
}: {
  scarico: StatisticheRiga["scarichi"][number];
}) {
  return (
    <>
      <Cell right>{fmtImportoTabella(scarico.importo)}</Cell>
      <Cell right>{scarico.nr}</Cell>
      <Cell right>{fmtPct(scarico.pctAffidato)}</Cell>
      <Cell right muted>
        {fmtPct(scarico.pctPezzi)}
      </Cell>
    </>
  );
}

export function StatisticheGriglia({
  righe,
  totale,
  dataReport,
  affidoDa,
  affidoA,
}: {
  righe: StatisticheRiga[];
  totale: StatisticheRiga;
  dataReport: string;
  affidoDa: string;
  affidoA: string;
}) {
  const th =
    "border border-[#b8c4d0] bg-white px-1.5 py-1 text-center text-[10px] font-bold uppercase leading-tight text-[#132033]";

  return (
    <div className="overflow-auto rounded border border-[#b8c4d0] bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-[#b8c4d0] bg-[#f5f7fa] px-3 py-2 text-xs text-[#132033]">
        <span>
          <span className="font-semibold">Data:</span> {dataReport}
        </span>
        <span className="hidden text-[var(--muted)] sm:inline">|</span>
        <span>
          <span className="font-semibold">Affido / Scadenza:</span> {affidoDa} — {affidoA}
        </span>
      </div>
      <table className="w-full min-w-[1200px] border-collapse">
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
        <tbody>
          {righe.map((riga, i) => (
            <Riga key={`${riga.esa}-${riga.mandato}-${riga.lottoCg}-${i}`} riga={riga} />
          ))}
          <Riga riga={totale} />
        </tbody>
      </table>
      <p className="border-t border-[#b8c4d0] bg-[#f5f7fa] px-3 py-1.5 text-[10px] text-[var(--muted)]">
        % Aff. = percentuale importo su affidato · % Pz = percentuale pezzi su Nr Prt · N/D = senza
        codice scarico (non ancora lavorate)
      </p>
    </div>
  );
}
