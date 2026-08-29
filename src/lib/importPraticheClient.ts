import {
  IMPORT_PRATICHE_CHUNK_SIZE,
  parseCsvHeader,
  validateCsvLottoRighe,
} from "@/lib/importCsvUtils";
import type { ImportPraticheSummary } from "@/components/ImportForm";

type PraticheImportContextClient = {
  batchId: string;
  mandanteId: string;
  mandanteCodice: string;
  perimetro: string;
  lotto: string;
  affidoIl: string;
  scadenzaMandato: string | null;
  isIntegrazione: boolean;
  fileName: string | null;
};

export function parseCsvFileText(text: string) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) {
    throw new Error("CSV vuoto");
  }
  const { delim, header } = parseCsvHeader(lines[0]);
  if (header.indexOf("nome") < 0) {
    throw new Error(
      "Colonna «nome» mancante nell'intestazione CSV (separatore ; o ,)"
    );
  }
  return {
    headerLine: lines[0],
    header,
    delim,
    dataLines: lines.slice(1),
  };
}

export { validateCsvLottoRighe, IMPORT_PRATICHE_CHUNK_SIZE };

export async function importPraticheCsvChunked(input: {
  mandanteId: string;
  perimetro: string;
  lotto: string;
  affidoIl: string;
  scadenzaMandato: string;
  fileName: string;
  csvText: string;
  onProgress?: (pct: number, detail: string) => void;
}): Promise<{ ok: string; importSummary: ImportPraticheSummary } | { error: string }> {
  let parsed: ReturnType<typeof parseCsvFileText>;
  try {
    parsed = parseCsvFileText(input.csvText);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "CSV non valido" };
  }

  const lottoCheck = validateCsvLottoRighe(
    [parsed.headerLine, ...parsed.dataLines],
    parsed.delim,
    parsed.header,
    input.lotto.trim()
  );
  if ("error" in lottoCheck) return lottoCheck;

  const totalRows = parsed.dataLines.length;
  input.onProgress?.(2, `Avvio import (${totalRows} righe)…`);

  const initRes = await fetch("/api/import/pratiche", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({
      step: "init",
      mandanteId: input.mandanteId,
      perimetro: input.perimetro,
      lotto: input.lotto,
      affidoIl: input.affidoIl,
      scadenzaMandato: input.scadenzaMandato || undefined,
      fileName: input.fileName,
    }),
  });

  let initData: {
    error?: string;
    ctx?: PraticheImportContextClient;
  } = {};
  try {
    initData = await initRes.json();
  } catch {
    return { error: "Risposta non valida dal server (init)" };
  }
  if (!initRes.ok || initData.error || !initData.ctx) {
    return { error: initData.error || "Impossibile avviare l'import" };
  }

  const ctx = initData.ctx;
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let maxScadenzaCsv: string | null = null;

  const chunks: string[][] = [];
  for (let i = 0; i < parsed.dataLines.length; i += IMPORT_PRATICHE_CHUNK_SIZE) {
    chunks.push(parsed.dataLines.slice(i, i + IMPORT_PRATICHE_CHUNK_SIZE));
  }

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]!;
    const doneRows = Math.min((i + 1) * IMPORT_PRATICHE_CHUNK_SIZE, totalRows);
    const pct = Math.round(5 + (doneRows / totalRows) * 90);
    input.onProgress?.(
      pct,
      `Righe ${doneRows}/${totalRows} (+${created} nuove, ${updated} righe aggiornate)`
    );

    const chunkRes = await fetch("/api/import/pratiche", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        step: "chunk",
        ctx,
        header: parsed.header,
        delim: parsed.delim,
        lines: chunk,
      }),
    });

    let chunkData: {
      error?: string;
      created?: number;
      updated?: number;
      skipped?: number;
      maxScadenza?: string | null;
    } = {};
    try {
      chunkData = await chunkRes.json();
    } catch {
      return {
        error: `Errore di rete al blocco ${i + 1}/${chunks.length}. Riprova l'import.`,
      };
    }
    if (!chunkRes.ok || chunkData.error) {
      return {
        error:
          chunkData.error ||
          `Errore al blocco ${i + 1}/${chunks.length} (righe ~${i * IMPORT_PRATICHE_CHUNK_SIZE + 1})`,
      };
    }

    created += chunkData.created ?? 0;
    updated += chunkData.updated ?? 0;
    skipped += chunkData.skipped ?? 0;
    if (chunkData.maxScadenza) {
      if (!maxScadenzaCsv || chunkData.maxScadenza > maxScadenzaCsv) {
        maxScadenzaCsv = chunkData.maxScadenza;
      }
    }
  }

  input.onProgress?.(96, "Finalizzazione…");

  const finRes = await fetch("/api/import/pratiche", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({
      step: "finalize",
      ctx,
      totals: { created, updated, skipped },
      maxScadenzaCsv,
    }),
  });

  let finData: {
    error?: string;
    ok?: string;
    importSummary?: ImportPraticheSummary;
  } = {};
  try {
    finData = await finRes.json();
  } catch {
    return { error: "Risposta non valida dal server (finalizzazione)" };
  }
  if (!finRes.ok || finData.error) {
    return { error: finData.error || "Errore in finalizzazione import" };
  }
  if (!finData.ok || !finData.importSummary) {
    return { error: "Import non completato" };
  }

  input.onProgress?.(100, "Completato");
  return { ok: finData.ok, importSummary: finData.importSummary };
}
