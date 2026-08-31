import { globalMetrics, type PrismaCallRecord } from "../lib/metrics";

export type FullScanEntry = {
  collection: string;
  model: string;
  method: string;
  scanKind: string;
  estimatedReads: number;
  rowsReturned: number;
  durationMs: number;
  block?: string;
  whereSummary: string;
  callerFile?: string;
};

/** Estrae full scan dalle chiamate instrumentate durante i benchmark. */
export function extractFullScansFromMetrics(): FullScanEntry[] {
  const scanKinds = new Set([
    "full_collection_scan",
    "aggregate",
    "groupBy",
    "count_fallback",
    "relation_prefetch",
  ]);

  return globalMetrics.calls
    .filter((c) => scanKinds.has(c.scanKind))
    .map((c) => ({
      collection: modelToCollection(c.model),
      model: c.model,
      method: `${c.delegate}.${c.method}`,
      scanKind: c.scanKind,
      estimatedReads: c.estimatedReads,
      rowsReturned: c.rowsReturned,
      durationMs: c.durationMs,
      block: c.block,
      whereSummary: c.whereSummary,
    }));
}

function modelToCollection(model: string): string {
  const map: Record<string, string> = {
    Pratica: "pratiche",
    Incasso: "incassi",
    User: "users",
    Attivita: "attivita",
    AuditLog: "auditLogs",
    Mandante: "mandanti",
    PraticaLock: "praticaLocks",
    MessaggioInterno: "messaggiInterni",
    ImpegnoAgenda: "impegniAgenda",
    Provvigione: "provvigioni",
  };
  return map[model] ?? model.toLowerCase();
}

/** Analisi statica: pattern noti nel codebase (senza modificare app). */
export const STATIC_FULL_SCAN_HOTSPOTS = [
  {
    file: "src/lib/praticheAltriFiltri.ts",
    function: "idsImportoTotale",
    pattern: "findMany tutte pratiche tenant → filter JS",
    collection: "pratiche",
  },
  {
    file: "src/lib/praticheAltriFiltri.ts",
    function: "idsTotIncassato",
    pattern: "findMany pratiche + findMany incassi → sum JS",
    collection: "pratiche, incassi",
  },
  {
    file: "src/lib/codiciMandantePerimetro.ts",
    function: "codiciPerMandantePerimetro",
    pattern: "findMany pratiche in scope → groupBy JS",
    collection: "pratiche",
  },
  {
    file: "src/lib/codiciMandantePerimetro.ts",
    function: "inLavorazionePerPerimetro",
    pattern: "findMany pratiche stati lavorazione → count JS",
    collection: "pratiche",
  },
  {
    file: "src/lib/lavorateOggi.ts",
    function: "mapCodiciCambiatiInGiornata",
    pattern: "findMany tutte pratiche scope + auditLog",
    collection: "pratiche, auditLogs",
  },
  {
    file: "src/app/(app)/page.tsx",
    function: "riepilogoMandanti",
    pattern: "findMany pratiche + include incassi → aggregate JS",
    collection: "pratiche, incassi",
  },
  {
    file: "src/app/(app)/affidi/page.tsx",
    function: "AffidiPage",
    pattern: "findMany intero scope pratiche",
    collection: "pratiche",
  },
  {
    file: "src/lib/firebase/firebasePrisma.ts",
    function: "aggregate / groupBy",
    pattern: "loadCollection → always full scan",
    collection: "*",
  },
] as const;

export function summarizeFullScans(calls: PrismaCallRecord[]) {
  const grouped = new Map<string, FullScanEntry & { occurrences: number; totalReads: number }>();
  for (const c of calls) {
    const key = `${c.model}|${c.method}|${c.scanKind}`;
    const entry = grouped.get(key) || {
      collection: modelToCollection(c.model),
      model: c.model,
      method: `${c.delegate}.${c.method}`,
      scanKind: c.scanKind,
      estimatedReads: c.estimatedReads,
      rowsReturned: c.rowsReturned,
      durationMs: c.durationMs,
      block: c.block,
      whereSummary: c.whereSummary,
      occurrences: 0,
      totalReads: 0,
    };
    entry.occurrences += 1;
    entry.totalReads += c.estimatedReads;
    entry.durationMs = Math.max(entry.durationMs, c.durationMs);
    grouped.set(key, entry);
  }
  return [...grouped.values()].sort((a, b) => b.totalReads - a.totalReads);
}
