import type { PraticaListaRow } from "@/lib/praticheListaRow";
import type { SortDir, SortField } from "@/lib/praticaSortFields";

function parseItDateLabel(label: string): number {
  if (!label || label === "—") return Number.NaN;
  const m = label.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return Number.NaN;
  return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])).getTime();
}

function parseEuroLabel(label: string): number {
  if (!label || label === "—") return Number.NaN;
  const n = Number(label.replace(/[^\d,.-]/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : Number.NaN;
}

function cmpNullable<T>(a: T, b: T, compare: (x: T, y: T) => number): number {
  const aNull = a == null || (typeof a === "number" && Number.isNaN(a));
  const bNull = b == null || (typeof b === "number" && Number.isNaN(b));
  if (aNull && bNull) return 0;
  if (aNull) return 1;
  if (bNull) return -1;
  return compare(a, b);
}

/** Ordinamento client elenchi già mappati in `PraticaListaRow` (Affidi, …). */
export function comparePraticaListaRow(
  a: PraticaListaRow,
  b: PraticaListaRow,
  field: SortField
): number {
  const strCmp = (x: string | null | undefined, y: string | null | undefined) =>
    cmpNullable(x?.trim() || null, y?.trim() || null, (s, t) =>
      String(s).localeCompare(String(t), "it")
    );
  switch (field) {
    case "numero":
      return a.numero.localeCompare(b.numero, "it");
    case "debitore":
      return strCmp(a.debitoreNome, b.debitoreNome) || a.numero.localeCompare(b.numero, "it");
    case "cap":
      return strCmp(a.debitoreCap, b.debitoreCap) || a.numero.localeCompare(b.numero, "it");
    case "citta":
      return strCmp(a.debitoreCitta, b.debitoreCitta) || a.numero.localeCompare(b.numero, "it");
    case "prov":
      return strCmp(a.debitoreProv, b.debitoreProv) || a.numero.localeCompare(b.numero, "it");
    case "telefono":
      return strCmp(a.debitoreTelefono, b.debitoreTelefono) || a.numero.localeCompare(b.numero, "it");
    case "dataAffido":
      return (
        cmpNullable(parseItDateLabel(a.dataAffidoLabel), parseItDateLabel(b.dataAffidoLabel), (x, y) => x - y) ||
        a.numero.localeCompare(b.numero, "it")
      );
    case "scadenza":
      return (
        cmpNullable(parseItDateLabel(a.scadenzaLabel), parseItDateLabel(b.scadenzaLabel), (x, y) => x - y) ||
        a.numero.localeCompare(b.numero, "it")
      );
    case "scadenzaStragiud":
      return (
        cmpNullable(
          parseItDateLabel(a.scadenzaStragiudizialeLabel),
          parseItDateLabel(b.scadenzaStragiudizialeLabel),
          (x, y) => x - y
        ) || a.numero.localeCompare(b.numero, "it")
      );
    case "mandante":
      return strCmp(a.mandanteCodice, b.mandanteCodice) || a.numero.localeCompare(b.numero, "it");
    case "lotto":
      return strCmp(a.lotto, b.lotto) || a.numero.localeCompare(b.numero, "it");
    case "assegnatario":
      return strCmp(a.assegnatarioNome, b.assegnatarioNome) || a.numero.localeCompare(b.numero, "it");
    case "codScarico":
      return strCmp(a.codScarico, b.codScarico) || a.numero.localeCompare(b.numero, "it");
    case "affidoProvv":
      return (a.affidoProvvisorio ? 1 : 0) - (b.affidoProvvisorio ? 1 : 0);
    case "stato":
      return strCmp(a.stato, b.stato) || a.numero.localeCompare(b.numero, "it");
    case "esito":
      return strCmp(a.esitoLabel, b.esitoLabel) || a.numero.localeCompare(b.numero, "it");
    case "ultimaLavorazione":
      return (
        cmpNullable(
          parseItDateLabel(a.ultimaLavorazioneLabel),
          parseItDateLabel(b.ultimaLavorazioneLabel),
          (x, y) => x - y
        ) || a.numero.localeCompare(b.numero, "it")
      );
    case "ultimaLavorazioneOra":
      return (
        cmpNullable(a.ultimaLavorazioneAtSort, b.ultimaLavorazioneAtSort, (x, y) => x - y) ||
        a.numero.localeCompare(b.numero, "it")
      );
    case "residuo":
      return (
        cmpNullable(parseEuroLabel(a.residuoLabel), parseEuroLabel(b.residuoLabel), (x, y) => x - y) ||
        a.numero.localeCompare(b.numero, "it")
      );
    case "importoRata":
      return (
        cmpNullable(parseEuroLabel(a.importoRataLabel), parseEuroLabel(b.importoRataLabel), (x, y) => x - y) ||
        a.numero.localeCompare(b.numero, "it")
      );
    case "rateScadute": {
      const na = a.rateScaduteLabel === "—" ? Number.NaN : Number(a.rateScaduteLabel);
      const nb = b.rateScaduteLabel === "—" ? Number.NaN : Number(b.rateScaduteLabel);
      return cmpNullable(na, nb, (x, y) => x - y) || a.numero.localeCompare(b.numero, "it");
    }
    case "totIncassato":
      return (
        cmpNullable(parseEuroLabel(a.totIncassatoLabel), parseEuroLabel(b.totIncassatoLabel), (x, y) => x - y) ||
        a.numero.localeCompare(b.numero, "it")
      );
    case "importoTot":
      return (
        cmpNullable(parseEuroLabel(a.importoTotaleLabel), parseEuroLabel(b.importoTotaleLabel), (x, y) => x - y) ||
        a.numero.localeCompare(b.numero, "it")
      );
    case "cfPiva":
      return strCmp(a.debitoreCf, b.debitoreCf) || a.numero.localeCompare(b.numero, "it");
    case "garante":
      return strCmp(a.garanteLabel, b.garanteLabel) || a.numero.localeCompare(b.numero, "it");
    default:
      return a.numero.localeCompare(b.numero, "it");
  }
}

export function sortPraticaListaRows(
  rows: PraticaListaRow[],
  sort: SortField,
  dir: SortDir
): PraticaListaRow[] {
  const mul = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const c = comparePraticaListaRow(a, b, sort);
    if (c !== 0) return mul * c;
    return a.numero.localeCompare(b.numero, "it");
  });
}
