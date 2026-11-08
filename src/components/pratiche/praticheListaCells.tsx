import type { ReactNode } from "react";
import Link from "next/link";
import { StatoBadge } from "@/components/ui";
import type { PraticaListaRow } from "@/lib/praticheListaRow";

/** Colonne elenco Pratiche (e Affidi allineato). */
export const PRATICHE_LISTA_COLS = [
  { key: "debitore", label: "Debitore", sortKey: "debitore" },
  { key: "numero", label: "Pratica n.", sortKey: "numero" },
  { key: "cap", label: "CAP", sortKey: "cap" },
  { key: "citta", label: "Città", sortKey: "citta" },
  { key: "prov", label: "Prov.", sortKey: "prov" },
  { key: "telefono", label: "Telefono", sortKey: "telefono" },
  { key: "dataAffido", label: "Data affido", sortKey: "dataAffido" },
  { key: "scadenza", label: "Scad. mandato", sortKey: "scadenza" },
  { key: "scadenzaStragiud", label: "Scad. stragiud.", sortKey: "scadenzaStragiud" },
  { key: "mandante", label: "Mandante", sortKey: "mandante" },
  { key: "lotto", label: "Perimetro", sortKey: "lotto" },
  { key: "assegnatario", label: "Assegnatario", sortKey: "assegnatario" },
  { key: "codScarico", label: "Cod. scarico", sortKey: "codScarico" },
  { key: "affidoProvv", label: "Aff. provv.", sortKey: "affidoProvv" },
  { key: "stato", label: "Stato", sortKey: "stato" },
  { key: "esito", label: "Esito contatto", sortKey: "esito" },
  { key: "ultimaLavorazione", label: "Ultima lavorazione", sortKey: "ultimaLavorazione" },
  { key: "ultimaLavorazioneOra", label: "Ora lav.", sortKey: "ultimaLavorazioneOra" },
  { key: "residuo", label: "Residuo", sortKey: "residuo" },
  { key: "importoRata", label: "Imp. rata", sortKey: "importoRata" },
  { key: "rateScadute", label: "Rate scad.", sortKey: "rateScadute" },
  { key: "totIncassato", label: "Tot. inc.", sortKey: "totIncassato" },
  { key: "importoTot", label: "Netto da pagare", sortKey: "importoTot" },
  { key: "cfPiva", label: "C.F. / P.IVA", sortKey: "cfPiva" },
  { key: "garante", label: "Garante", sortKey: "garante" },
] as const;

/** Larghezza minima tabella elenco (Pratiche / Affidi). */
export function praticheListaTableMinWidth(extraColsPx = 0) {
  return Math.max(1400, PRATICHE_LISTA_COLS.length * 120 + extraColsPx);
}

export type PraticheListaColKey = (typeof PRATICHE_LISTA_COLS)[number]["key"];

/** Larghezze fisse: offset sticky allineato al layout colonna (niente “salto” in scroll). */
const STICKY_DEBITORE_W =
  "w-36 min-w-36 max-w-36 box-border overflow-hidden";
const STICKY_NUMERO_W =
  "w-[7.5rem] min-w-[7.5rem] max-w-[7.5rem] box-border";

/** Debitore + pratica n. restano visibili con lo scroll orizzontale (dopo eventuale colonna selezione). */
export function praticheListaStickyClass(
  colKey: PraticheListaColKey,
  opts: {
    hasLeadingCol: boolean;
    surface: "header" | "body";
    rowSelected?: boolean;
  }
): string {
  if (colKey !== "debitore" && colKey !== "numero") return "";
  const bg =
    opts.surface === "header"
      ? "bg-[#e8eef4]"
      : opts.rowSelected
        ? "bg-[#eef4f8]"
        : "bg-white";
  const debitoreLeft = opts.hasLeadingCol ? "left-10" : "left-0";
  /** 2.5rem (colonna selezione) + 9rem debitore, oppure solo 9rem */
  const numeroLeft = opts.hasLeadingCol ? "left-[11.5rem]" : "left-36";
  if (colKey === "debitore") {
    return `sticky z-[2] ${STICKY_DEBITORE_W} ${debitoreLeft} ${bg}`;
  }
  return `sticky z-[3] ${STICKY_NUMERO_W} shadow-[2px_0_4px_-2px_rgba(0,0,0,0.12)] ${numeroLeft} ${bg}`;
}

export function PraticheListaColgroup({ hasLeadingCol }: { hasLeadingCol?: boolean }) {
  return (
    <colgroup>
      {hasLeadingCol ? <col className="w-10" style={{ width: "2.5rem" }} /> : null}
      <col style={{ width: "9rem" }} />
      <col style={{ width: "7.5rem" }} />
      {PRATICHE_LISTA_COLS.slice(2).map((c) => (
        <col key={c.key} />
      ))}
    </colgroup>
  );
}

export function praticheListaCell(p: PraticaListaRow, key: PraticheListaColKey): ReactNode {
  switch (key) {
    case "numero":
      return (
        <Link className="text-[var(--accent)] underline" href={p.href}>
          {p.numero}
        </Link>
      );
    case "debitore":
      return <span className="block truncate">{p.debitoreNome}</span>;
    case "cap":
      return p.debitoreCap || "—";
    case "citta":
      return p.debitoreCitta || "—";
    case "prov":
      return p.debitoreProv || "—";
    case "telefono":
      return p.debitoreTelefono || "—";
    case "dataAffido":
      return p.dataAffidoLabel;
    case "scadenza":
      return p.scadenzaLabel;
    case "scadenzaStragiud":
      return (
        <span
          className={
            p.preavvisoStragiudiziale ? "font-semibold text-amber-800" : undefined
          }
        >
          {p.scadenzaStragiudizialeLabel}
        </span>
      );
    case "mandante":
      return p.mandanteCodice;
    case "lotto":
      return p.lotto || "—";
    case "assegnatario":
      return p.assegnatarioNome || "—";
    case "codScarico":
      return p.codScarico || "—";
    case "affidoProvv":
      return p.affidoProvvisorio ? "Sì" : "—";
    case "stato":
      return <StatoBadge stato={p.stato} />;
    case "esito":
      return p.esitoLabel;
    case "ultimaLavorazione":
      return (
        <span className="whitespace-nowrap tabular-nums">{p.ultimaLavorazioneLabel}</span>
      );
    case "ultimaLavorazioneOra":
      return (
        <span className="whitespace-nowrap tabular-nums">{p.ultimaLavorazioneOraLabel}</span>
      );
    case "residuo":
      return p.residuoLabel;
    case "importoRata":
      return p.importoRataLabel;
    case "rateScadute":
      return p.rateScaduteLabel;
    case "totIncassato":
      return p.totIncassatoLabel;
    case "importoTot":
      return (
        <span className="font-bold text-[#b91c1c]">{p.importoTotaleLabel}</span>
      );
    case "cfPiva":
      return p.debitoreCf || "—";
    case "garante":
      return p.garanteLabel;
    default:
      return "—";
  }
}
