export type ProvvigioniSortField =
  | "perimetro"
  | "data"
  | "operatore"
  | "codiceScarico"
  | "modo"
  | "fattura"
  | "pratica"
  | "debitore"
  | "incasso"
  | "percentuale"
  | "provvigione"
  | "stato";

export type ProvvigioniSortDir = "asc" | "desc";

export type ProvvigioneRigaOrdinabile = {
  perimetro: string;
  perimetroLabel?: string;
  data: string;
  operatoreNome: string;
  codiceScarico: string;
  modo?: string;
  fattura?: string;
  praticaNumero: string;
  debitoreNome: string;
  baseImporto: number;
  percentuale: number;
  importo: number;
  stato: string;
  statoLabel: string;
};

function parseDataIt(s: string): number {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s.trim());
  if (!m) return 0;
  return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])).getTime();
}

function testo(a: string | undefined | null) {
  return (a ?? "").trim().toLocaleLowerCase("it");
}

export function compareProvvigioniRighe(
  a: ProvvigioneRigaOrdinabile,
  b: ProvvigioneRigaOrdinabile,
  field: ProvvigioniSortField,
  dir: ProvvigioniSortDir
): number {
  let cmp = 0;
  switch (field) {
    case "perimetro":
      cmp = testo(a.perimetroLabel || a.perimetro).localeCompare(
        testo(b.perimetroLabel || b.perimetro),
        "it"
      );
      break;
    case "data":
      cmp = parseDataIt(a.data) - parseDataIt(b.data);
      break;
    case "operatore":
      cmp = testo(a.operatoreNome).localeCompare(testo(b.operatoreNome), "it");
      break;
    case "codiceScarico":
      cmp = testo(a.codiceScarico).localeCompare(testo(b.codiceScarico), "it");
      break;
    case "modo":
      cmp = testo(a.modo).localeCompare(testo(b.modo), "it");
      break;
    case "fattura":
      cmp = testo(a.fattura).localeCompare(testo(b.fattura), "it");
      break;
    case "pratica":
      cmp = testo(a.praticaNumero).localeCompare(testo(b.praticaNumero), "it");
      break;
    case "debitore":
      cmp = testo(a.debitoreNome).localeCompare(testo(b.debitoreNome), "it");
      break;
    case "incasso":
      cmp = a.baseImporto - b.baseImporto;
      break;
    case "percentuale":
      cmp = a.percentuale - b.percentuale;
      break;
    case "provvigione":
      cmp = a.importo - b.importo;
      break;
    case "stato":
      cmp = testo(a.statoLabel || a.stato).localeCompare(
        testo(b.statoLabel || b.stato),
        "it"
      );
      break;
    default:
      cmp = 0;
  }
  return dir === "asc" ? cmp : -cmp;
}

export function sortProvvigioniRighe<T extends ProvvigioneRigaOrdinabile>(
  righe: T[],
  field: ProvvigioniSortField,
  dir: ProvvigioniSortDir
): T[] {
  return [...righe].sort((a, b) => compareProvvigioniRighe(a, b, field, dir));
}

export function nextProvvigioniSort(
  currentField: ProvvigioniSortField,
  currentDir: ProvvigioniSortDir,
  field: ProvvigioniSortField
): { field: ProvvigioniSortField; dir: ProvvigioniSortDir } {
  if (field === currentField) {
    return { field, dir: currentDir === "asc" ? "desc" : "asc" };
  }
  return { field, dir: "asc" };
}
