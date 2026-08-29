/** Utilità CSV condivise (client e server, senza dipendenze server-only). */

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

/** Verifica che i valori «lotto» nel CSV coincidano con quello indicato in importazione. */
export function validateCsvLottoRighe(
  lines: string[],
  delim: string,
  header: string[],
  lottoForm: string
): { ok: true } | { error: string } {
  const lottoIdx = csvColIndex(header, "lotto", "numero_mandante", "numero mandante");
  if (lottoIdx < 0) return { ok: true };

  const lottoAtteso = lottoForm.trim();
  const idxNome = header.indexOf("nome");
  const mismatches: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(delim);
    const nome = cols[idxNome]?.trim();
    if (!nome) continue;

    const lottoCell = cols[lottoIdx]?.trim() || "";
    if (!lottoCell) continue;

    if (lottoCell !== lottoAtteso) {
      mismatches.push(`riga ${i + 1}: «${lottoCell}»`);
      if (mismatches.length >= 5) break;
    }
  }

  if (mismatches.length === 0) return { ok: true };

  const altre =
    mismatches.length >= 5 ? " Controlla anche le righe successive." : "";
  return {
    error: `Il lotto nel CSV non coincide con quello indicato in importazione («${lottoAtteso}»): ${mismatches.join(", ")}.${altre}`,
  };
}

/** Righe per richiesta API: resta entro il timeout Netlify (~10s). */
export const IMPORT_PRATICHE_CHUNK_SIZE = 15;
