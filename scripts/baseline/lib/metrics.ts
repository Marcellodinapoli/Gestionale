export type ScanKind =
  | "indexed_query"
  | "full_collection_scan"
  | "aggregate"
  | "groupBy"
  | "count_fallback"
  | "get_by_id"
  | "relation_prefetch"
  | "delete_many"
  | "unknown";

export type PrismaCallRecord = {
  id: number;
  delegate: string;
  method: string;
  model: string;
  durationMs: number;
  estimatedReads: number;
  estimatedWrites?: number;
  rowsReturned: number;
  scanKind: ScanKind;
  hasTake: boolean;
  hasSkip: boolean;
  callerHint?: string;
  whereSummary: string;
  block?: string;
};

export type BlockTiming = {
  block: string;
  durationMs: number;
  prismaCalls: number;
  estimatedReads: number;
};

export class MetricsCollector {
  private nextId = 1;
  readonly calls: PrismaCallRecord[] = [];
  readonly blocks: BlockTiming[] = [];
  private activeBlock: string | undefined;
  private blockStart = 0;
  private blockCallsStart = 0;

  startBlock(name: string) {
    this.activeBlock = name;
    this.blockStart = performance.now();
    this.blockCallsStart = this.calls.length;
  }

  endBlock() {
    if (!this.activeBlock) return;
    const blockCalls = this.calls.slice(this.blockCallsStart);
    this.blocks.push({
      block: this.activeBlock,
      durationMs: Math.round(performance.now() - this.blockStart),
      prismaCalls: blockCalls.length,
      estimatedReads: blockCalls.reduce((s, c) => s + c.estimatedReads, 0),
    });
    this.activeBlock = undefined;
  }

  record(partial: Omit<PrismaCallRecord, "id" | "block">) {
    const rec: PrismaCallRecord = {
      id: this.nextId++,
      block: this.activeBlock,
      ...partial,
    };
    this.calls.push(rec);
    return rec;
  }

  summary() {
    const totalMs = this.calls.reduce((s, c) => s + c.durationMs, 0);
    const slowest = [...this.calls].sort((a, b) => b.durationMs - a.durationMs).slice(0, 10);
    const byScan = new Map<ScanKind, { count: number; reads: number }>();
    let estimatedWrites = 0;
    for (const c of this.calls) {
      const cur = byScan.get(c.scanKind) || { count: 0, reads: 0 };
      cur.count += 1;
      cur.reads += c.estimatedReads;
      byScan.set(c.scanKind, cur);
      if (["create", "update", "delete", "deleteMany", "updateMany", "createMany", "upsert"].includes(c.method)) {
        estimatedWrites += c.estimatedWrites ?? (c.method.endsWith("Many") ? c.rowsReturned : 1);
      }
    }
    return {
      prismaCalls: this.calls.length,
      estimatedFirestoreReads: this.calls.reduce((s, c) => s + c.estimatedReads, 0),
      estimatedFirestoreWrites: estimatedWrites,
      totalPrismaDurationMs: Math.round(totalMs),
      slowestQueries: slowest,
      byScanKind: Object.fromEntries(byScan),
      blocks: this.blocks,
    };
  }

  reset() {
    this.nextId = 1;
    this.calls.length = 0;
    this.blocks.length = 0;
    this.activeBlock = undefined;
  }
}

/** Singleton per run baseline — instrumentedPrisma scrive qui. */
export const globalMetrics = new MetricsCollector();
