import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** Ruoli le cui note non contano come lavorazione operativa. */
export const RUOLI_NOTA_NON_LAVORAZIONE = [
  "ADMIN",
  "BACK_OFFICE",
  "AMMINISTRAZIONE",
] as const;

/** Filtro attività: solo lavorazione (esclude note massiva / note staff admin-BO-amm). */
export const attivitaLavorazioneWhere: Prisma.AttivitaWhereInput = {
  user: { role: { notIn: [...RUOLI_NOTA_NON_LAVORAZIONE] } },
};

export type SortField =
  | "numero"
  | "debitore"
  | "cap"
  | "citta"
  | "prov"
  | "telefono"
  | "dataAffido"
  | "scadenza"
  | "mandante"
  | "lotto"
  | "assegnatario"
  | "codScarico"
  | "affidoProvv"
  | "stato"
  | "esito"
  | "ultimaLavorazione"
  | "residuo"
  | "importoRata"
  | "totIncassato"
  | "importoTot"
  | "cfPiva"
  | "garante";

export type SortDir = "asc" | "desc";

export const SORT_COLUMNS: { key: SortField; label: string }[] = [
  { key: "numero", label: "Numero" },
  { key: "debitore", label: "Debitore" },
  { key: "cap", label: "CAP" },
  { key: "citta", label: "Città" },
  { key: "prov", label: "Prov." },
  { key: "telefono", label: "Telefono" },
  { key: "dataAffido", label: "Data affido" },
  { key: "scadenza", label: "Scad. mandato" },
  { key: "mandante", label: "Mandante" },
  { key: "lotto", label: "Perimetro" },
  { key: "assegnatario", label: "Assegnatario" },
  { key: "codScarico", label: "Cod. scarico" },
  { key: "affidoProvv", label: "Aff. provv." },
  { key: "stato", label: "Stato" },
  { key: "esito", label: "Esito contatto" },
  { key: "ultimaLavorazione", label: "Ultima lavorazione" },
  { key: "residuo", label: "Residuo" },
  { key: "importoRata", label: "Imp. rata" },
  { key: "totIncassato", label: "Tot. inc." },
  { key: "importoTot", label: "Imp. tot." },
  { key: "cfPiva", label: "C.F. / P.IVA" },
  { key: "garante", label: "Garante" },
];

export function parseSort(raw?: string | null): SortField {
  if (raw === "ultimoPagamento") return "ultimaLavorazione";
  if (raw && SORT_COLUMNS.some((c) => c.key === raw)) return raw as SortField;
  return "ultimaLavorazione";
}

export function parseDir(raw?: string | null, sort: SortField = "ultimaLavorazione"): SortDir {
  if (raw === "asc" || raw === "desc") return raw;
  return sort === "ultimaLavorazione" ? "asc" : "desc";
}

export function isUltimaLavorazioneSort(sort: SortField) {
  return sort === "ultimaLavorazione";
}

export function buildOrderBy(
  sort: SortField,
  dir: SortDir
): Prisma.PraticaOrderByWithRelationInput {
  switch (sort) {
    case "numero":
      return { numero: dir };
    case "debitore":
      return { debitore: { cognome: dir } };
    case "cap":
      return { debitore: { cap: dir } };
    case "citta":
      return { debitore: { citta: dir } };
    case "prov":
      return { debitore: { provincia: dir } };
    case "telefono":
      return { debitore: { telefono: dir } };
    case "dataAffido":
      return { dataAffido: dir };
    case "scadenza":
      return { scadenza: dir };
    case "mandante":
      return { mandante: { codice: dir } };
    case "lotto":
      return { numeroMandante: dir };
    case "assegnatario":
      return { assegnatario: { name: dir } };
    case "codScarico":
      return { codiceScarico: dir };
    case "affidoProvv":
      return { operatoreTitolareId: dir };
    case "stato":
      return { stato: dir };
    case "esito":
      return { esitoContatto: dir };
    case "residuo":
      return { residuo: dir };
    case "importoRata":
      return { rate: { _count: dir } };
    case "totIncassato":
      return { incassi: { _count: dir } };
    case "importoTot":
      return { capitale: dir };
    case "cfPiva":
      return { debitore: { codiceFiscale: dir } };
    case "garante":
      return { garanti: { _count: dir } };
    case "ultimaLavorazione":
      return { numero: dir };
    default:
      return { numero: dir };
  }
}

/**
 * IDs ordinati per ultima lavorazione operativa (asc = più vecchia prima;
 * mai lavorate in cima con asc, in fondo con desc).
 * Esclude note di admin / back office / amministrazione (anche massiva).
 */
export async function orderPraticaIdsByUltimaLavorazione(
  where: Prisma.PraticaWhereInput,
  dir: SortDir,
  skip: number,
  take: number
): Promise<string[]> {
  const rows = await prisma.pratica.findMany({
    where,
    select: {
      id: true,
      numero: true,
      attivita: {
        where: attivitaLavorazioneWhere,
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { createdAt: true },
      },
    },
  });

  rows.sort((a, b) => {
    const ta = a.attivita[0]?.createdAt?.getTime();
    const tb = b.attivita[0]?.createdAt?.getTime();
    const aNull = ta == null;
    const bNull = tb == null;
    if (aNull && bNull) return a.numero.localeCompare(b.numero, "it");
    if (aNull) return dir === "asc" ? -1 : 1;
    if (bNull) return dir === "asc" ? 1 : -1;
    const cmp = ta! - tb!;
    if (cmp !== 0) return dir === "asc" ? cmp : -cmp;
    return a.numero.localeCompare(b.numero, "it");
  });

  return rows.slice(skip, skip + take).map((r) => r.id);
}

export const ultimaLavorazioneInclude = {
  where: attivitaLavorazioneWhere,
  orderBy: { createdAt: "desc" as const },
  take: 1,
  select: { createdAt: true },
};
