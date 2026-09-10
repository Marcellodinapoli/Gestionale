"use client";

import { Fragment } from "react";
import type { StatisticheRiga, StatisticheSezione } from "@/lib/statisticheGruppoUi";
import { fmtPct } from "@/lib/scarico";
import { fmtImportoTabella, colspanTabellaStatistiche } from "@/lib/statisticheGruppoUi";

const SCARICO_TONI = [
  { head: "#dceaf7", body: "#f3f8fd", total: "#e4eef8" },
  { head: "#dfeedd", body: "#f4faf3", total: "#e8f2e6" },
  { head: "#f5ead4", body: "#fdf8f0", total: "#f3e8d4" },
  { head: "#e8ddf0", body: "#f7f2fb", total: "#ede4f5" },
  { head: "#d9eeea", body: "#f0faf8", total: "#e0f0ec" },
  { head: "#f5dddd", body: "#fdf5f5", total: "#f0e0e0" },
] as const;

function scaricoTone(index: number) {
  return SCARICO_TONI[index % SCARICO_TONI.length]!;
}

function Cell({
  children,
  right,
  bold,
  muted,
  bg,
}: {
  children: React.ReactNode;
  right?: boolean;
  bold?: boolean;
  muted?: boolean;
  bg?: string;
}) {
  return (
    <td
      style={bg ? { backgroundColor: bg } : undefined}
      className={`border border-[#b8c4d0] px-1.5 py-0.5 font-mono text-[11px] leading-5 whitespace-nowrap ${
        right ? "text-right" : "text-left"
      } ${bg ? "" : bold ? "bg-[#eef2f6] font-bold" : "bg-white"} ${bold ? "font-bold" : ""} ${muted ? "text-[var(--muted)]" : "text-[#132033]"}`}
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
      <Cell>{riga.perimetro}</Cell>
      <Cell>{riga.lotto}</Cell>
      <Cell right>{riga.nrPrt}</Cell>
      <Cell right muted={nascondiImporti}>
        {importoCell(riga.affidato, nascondiImporti)}
      </Cell>
      <Cell right muted={nascondiImporti}>
        {importoCell(riga.incassato, nascondiImporti)}
      </Cell>
      <Cell right bold={riga.isTotale}>
        {riga.movimentate}
      </Cell>
      {riga.scarichi.map((s, i) => (
        <FragmentRow
          key={s.codice}
          scarico={s}
          codiceIdx={i}
          isTotale={Boolean(riga.isTotale)}
          nascondiImporti={nascondiImporti}
        />
      ))}
    </tr>
  );
}

function FragmentRow({
  scarico,
  codiceIdx,
  isTotale,
  nascondiImporti,
}: {
  scarico: StatisticheRiga["scarichi"][number];
  codiceIdx: number;
  isTotale: boolean;
  nascondiImporti: boolean;
}) {
  const bg = isTotale ? scaricoTone(codiceIdx).total : scaricoTone(codiceIdx).body;
  return (
    <>
      <Cell right muted={nascondiImporti} bg={bg}>
        {importoCell(scarico.importo, nascondiImporti)}
      </Cell>
      <Cell right bg={bg}>
        {fmtPct(scarico.pctPz)}
      </Cell>
      <Cell right bg={bg} bold={isTotale}>
        {scarico.nr}
      </Cell>
    </>
  );
}

/** Larghezza minima tabella: cresce con i codici scarico del perimetro. */
function tableMinWidthPx(codiciCount: number) {
  const fixed = 8 * 92;
  const perCodice = 3 * 88;
  return Math.max(1200, fixed + Math.max(codiciCount, 1) * perCodice);
}

function Intestazione({ codiciScarico }: { codiciScarico: string[] }) {
  const thBase =
    "border border-[#b8c4d0] px-1.5 py-1 text-center text-[10px] font-bold uppercase leading-tight text-[#132033]";
  const thFixed = `${thBase} bg-white`;
  const blocchi = codiciScarico;
  return (
    <thead>
      <tr>
        <th className={thFixed} rowSpan={2}>
          Esa
        </th>
        <th className={thFixed} rowSpan={2}>
          Mandato
        </th>
        <th className={thFixed} rowSpan={2}>
          Perimetro
        </th>
        <th className={thFixed} rowSpan={2}>
          Lotto
        </th>
        <th className={thFixed} rowSpan={2}>
          Nr Prt
        </th>
        <th className={thFixed} rowSpan={2}>
          Affidato
        </th>
        <th className={thFixed} rowSpan={2}>
          Incassato
        </th>
        <th className={thFixed} rowSpan={2}>
          Movimentate
        </th>
        {blocchi.map((code, i) => (
          <th
            key={code}
            className={thBase}
            style={{ backgroundColor: scaricoTone(i).head }}
            colSpan={3}
          >
            {code}
          </th>
        ))}
      </tr>
      <tr>
        {blocchi.map((code, i) => (
          <Fragment key={code}>
            <th className={thBase} style={{ backgroundColor: scaricoTone(i).head }}>
              Incassato
            </th>
            <th className={thBase} style={{ backgroundColor: scaricoTone(i).head }}>
              % Pz
            </th>
            <th className={thBase} style={{ backgroundColor: scaricoTone(i).head }}>
              Pz
            </th>
          </Fragment>
        ))}
      </tr>
    </thead>
  );
}

function TabellaScroll({
  codiciScarico,
  children,
  className,
  titleClassName,
  title,
}: {
  codiciScarico: string[];
  children: React.ReactNode;
  className: string;
  titleClassName: string;
  title: React.ReactNode;
}) {
  return (
    <div className={`min-w-0 max-w-full ${className}`}>
      <div className={titleClassName}>{title}</div>
      <div className="min-w-0 max-w-full overflow-x-auto overscroll-x-contain">
        <table
          className="w-max max-w-none border-collapse"
          style={{ minWidth: tableMinWidthPx(codiciScarico.length) }}
        >
          <Intestazione codiciScarico={codiciScarico} />
          {children}
        </table>
      </div>
    </div>
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
  const codiciTotaleAgenzia = [
    ...new Set(sezioni.flatMap((s) => s.codiciScarico)),
  ].sort();

  return (
    <div className="min-w-0 max-w-full space-y-4">
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
        <TabellaScroll
          key={sez.perimetro}
          codiciScarico={sez.codiciScarico}
          className="rounded border border-[#b8c4d0] bg-white shadow-sm"
          titleClassName="border-b border-[#b8c4d0] bg-[#e8eef4] px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-[#132033]"
          title={<>Perimetro {sez.perimetro}</>}
        >
          <tbody>
            {sez.righe.map((riga, i) => (
              <Riga
                key={`${riga.esa}-${riga.mandato}-${riga.perimetro}-${riga.lotto}-${i}`}
                riga={riga}
                nascondiImporti={nascondiImporti}
              />
            ))}
            {!sez.righe.length ? (
              <tr>
                <td
                  colSpan={colspanTabellaStatistiche(sez.codiciScarico)}
                  className="border border-[#b8c4d0] bg-white px-3 py-4 text-center text-xs text-[var(--muted)]"
                >
                  Nessuna pratica nel periodo · tutti gli operatori del gruppo
                </td>
              </tr>
            ) : null}
            <Riga riga={sez.subtotale} nascondiImporti={nascondiImporti} />
          </tbody>
        </TabellaScroll>
      ))}

      {mostraTotaliAzienda && sezioni.length > 1 ? (
        <TabellaScroll
          codiciScarico={codiciTotaleAgenzia}
          className="rounded border-2 border-[#132033] bg-white shadow-sm"
          titleClassName="border-b border-[#132033] bg-[#132033] px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-white"
          title="Totale agenzia · tutti i perimetri"
        >
          <tbody>
            <Riga riga={totale} nascondiImporti={nascondiImporti} />
          </tbody>
        </TabellaScroll>
      ) : null}

      <p className="text-[10px] text-[var(--muted)]">
        Incassato (totale riga) = somma incassi operatore · Incassato per codice = totale euro
        su quel codice scarico · % Pz = pratiche incassate codice su Nr Prt operatore · Pz =
        conteggio pratiche incassate con codice.
      </p>
    </div>
  );
}
