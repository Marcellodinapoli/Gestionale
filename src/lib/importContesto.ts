import { parseDateOnly } from "@/lib/domain";
import { parsePerimetri } from "@/lib/mandantePerimetri";
import { prisma } from "@/lib/prisma";

export type ImportContesto = {
  mandanteId: string;
  mandanteCodice: string;
  perimetro: string;
  lotto: string;
  affidoIl: Date;
  scadenzaMandato: Date | null;
};

/** Separatore CSV: ; (IT) o , (Excel/export). Preferisce quello che espone «nome». */
export function detectCsvDelimiter(headerLine: string): ";" | "," {
  const norm = headerLine.trim().toLowerCase().replace(/^\uFEFF/, "");
  const colsSemi = norm.split(";").map((h) => h.trim());
  const colsComma = norm.split(",").map((h) => h.trim());
  if (colsSemi.includes("nome")) return ";";
  if (colsComma.includes("nome")) return ",";
  if (colsSemi.includes("numero") || colsSemi.includes("pratica")) return ";";
  if (colsComma.includes("numero") || colsComma.includes("pratica")) return ",";
  const nSemi = (norm.match(/;/g) || []).length;
  const nComma = (norm.match(/,/g) || []).length;
  return nSemi >= nComma ? ";" : ",";
}

export function parseCsvHeader(headerLine: string) {
  const delim = detectCsvDelimiter(headerLine);
  const header = headerLine
    .split(delim)
    .map((h) => h.trim().toLowerCase().replace(/^\uFEFF/, ""));
  return { delim, header };
}

/** Normalizza nome colonna CSV (spazi → _, senza punti). */
export function normalizeCsvColName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/^\uFEFF/, "")
    .replace(/[.\u00a0]/g, " ")
    .replace(/\s+/g, "_");
}

/** Indice colonna CSV per uno qualsiasi degli alias. */
export function csvColIndex(header: string[], ...aliases: string[]) {
  const map = header.map(normalizeCsvColName);
  for (const alias of aliases) {
    const i = map.indexOf(normalizeCsvColName(alias));
    if (i >= 0) return i;
  }
  return -1;
}

function parseCsvNumberRaw(raw: string | undefined | null): number | null {
  if (raw == null) return null;
  const t = String(raw).trim();
  if (!t) return null;
  // Supporta 8547,67 e 8.547,67
  let s = t.replace(/\s/g, "");
  if (s.includes(",") && s.includes(".")) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else {
    s = s.replace(",", ".");
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function csvMoney(
  cols: string[],
  header: string[],
  ...aliases: string[]
): number | null {
  const i = csvColIndex(header, ...aliases);
  if (i < 0) return null;
  return parseCsvNumberRaw(cols[i]);
}

export function csvInt(
  cols: string[],
  header: string[],
  ...aliases: string[]
): number | null {
  const n = csvMoney(cols, header, ...aliases);
  if (n == null) return null;
  return Math.round(n);
}

/** Testo da colonna CSV; `null` se colonna assente o cella vuota. */
export function csvStr(
  cols: string[],
  header: string[],
  ...aliases: string[]
): string | null {
  const i = csvColIndex(header, ...aliases);
  if (i < 0) return null;
  const v = cols[i]?.trim();
  return v || null;
}

/** Legge e valida mandante / perimetro / lotto / affido dal form di import. */
export async function parseImportContesto(
  formData: FormData,
  tenantId: string
): Promise<{ ok: ImportContesto } | { error: string }> {
  const mandanteId = String(formData.get("mandanteId") || "").trim();
  const perimetro = String(formData.get("perimetro") || "").trim();
  const lotto = String(formData.get("lotto") || "").trim();
  const affidoRaw = String(formData.get("affidoIl") || "").trim();
  const scadenzaMandatoRaw = String(formData.get("scadenzaMandato") || "").trim();

  if (!mandanteId) return { error: "Seleziona la mandante" };
  if (!perimetro) return { error: "Seleziona o indica il perimetro" };
  if (!lotto) return { error: "Indica il lotto" };

  const affidoIl = parseDateOnly(affidoRaw);
  if (!affidoIl) return { error: "Data affido non valida" };

  const scadenzaMandato = scadenzaMandatoRaw
    ? parseDateOnly(scadenzaMandatoRaw)
    : null;
  if (scadenzaMandatoRaw && !scadenzaMandato) {
    return { error: "Scadenza mandato non valida" };
  }

  const mandante = await prisma.mandante.findFirst({
    where: { id: mandanteId, tenantId },
    select: { id: true, codice: true, perimetri: true },
  });
  if (!mandante) return { error: "Mandante non trovata" };

  const elenco = parsePerimetri(mandante.perimetri);
  if (
    elenco.length > 0 &&
    !elenco.some(
      (p) =>
        p.nomeMandante === perimetro ||
        p.descrizione === perimetro ||
        p.nomeInterno === perimetro
    )
  ) {
    return { error: "Perimetro non valido per la mandante selezionata" };
  }

  return {
    ok: {
      mandanteId: mandante.id,
      mandanteCodice: mandante.codice,
      perimetro,
      lotto,
      affidoIl,
      scadenzaMandato,
    },
  };
}

/** Intervallo giornata (locale) per filtrare pratiche per data affido. */
export function giornoAffidoRange(affidoIl: Date) {
  const start = new Date(
    affidoIl.getFullYear(),
    affidoIl.getMonth(),
    affidoIl.getDate(),
    0,
    0,
    0,
    0
  );
  const end = new Date(
    affidoIl.getFullYear(),
    affidoIl.getMonth(),
    affidoIl.getDate(),
    23,
    59,
    59,
    999
  );
  return { start, end };
}
