"use client";

export type LockStreamEvent = {
  owned: boolean;
  lockedByName: string | null;
};

export type LockStreamCallbacks = {
  onUpdate: (event: LockStreamEvent) => void;
  onError?: () => void;
};

export type MemoAlertsStreamEvent = {
  alerts: Array<Record<string, unknown>>;
  total: number;
};

export type MemoAlertsStreamCallbacks = {
  onUpdate: (event: MemoAlertsStreamEvent) => void;
  onError?: () => void;
};

const FALLBACK_POLL_MIN_MS = 30_000;
const FALLBACK_POLL_MAX_MS = 60_000;
const MEMO_FALLBACK_POLL_MIN_MS = 45_000;
const MEMO_FALLBACK_POLL_MAX_MS = 90_000;

/**
 * Realtime lock — SSE via Next.js proxy, fallback polling adattivo.
 * Il browser non interroga il lock ogni 15s: heartbeat separato (30s) solo se owner.
 */
export function subscribeLock(praticaId: string, callbacks: LockStreamCallbacks): () => void {
  const url = `/api/pratiche/${encodeURIComponent(praticaId)}/lock/stream`;
  let closed = false;
  let fallbackTimer: ReturnType<typeof setTimeout> | null = null;
  let fallbackMs = FALLBACK_POLL_MIN_MS;
  let es: EventSource | null = null;

  const emit = (event: LockStreamEvent) => {
    if (!closed) callbacks.onUpdate(event);
  };

  const scheduleFallbackPoll = () => {
    if (closed) return;
    fallbackTimer = setTimeout(async () => {
      if (closed) return;
      try {
        const res = await fetch(`/api/pratiche/${encodeURIComponent(praticaId)}/lock`);
        if (res.ok) {
          const data = (await res.json()) as LockStreamEvent & { owned?: boolean };
          emit({
            owned: Boolean(data.owned),
            lockedByName: data.lockedByName ?? null,
          });
          fallbackMs = FALLBACK_POLL_MIN_MS;
        } else {
          fallbackMs = Math.min(fallbackMs * 1.5, FALLBACK_POLL_MAX_MS);
          callbacks.onError?.();
        }
      } catch {
        fallbackMs = Math.min(fallbackMs * 1.5, FALLBACK_POLL_MAX_MS);
        callbacks.onError?.();
      }
      scheduleFallbackPoll();
    }, fallbackMs);
  };

  const startFallback = () => {
    if (fallbackTimer) return;
    scheduleFallbackPoll();
  };

  if (typeof EventSource !== "undefined") {
    try {
      es = new EventSource(url);
      es.addEventListener("lock", (ev) => {
        try {
          const data = JSON.parse((ev as MessageEvent).data) as LockStreamEvent;
          emit(data);
        } catch {
          /* ignore */
        }
      });
      es.onerror = () => {
        es?.close();
        es = null;
        callbacks.onError?.();
        startFallback();
      };
    } catch {
      startFallback();
    }
  } else {
    startFallback();
  }

  return () => {
    closed = true;
    es?.close();
    if (fallbackTimer) clearTimeout(fallbackTimer);
  };
}

/**
 * Memo alerts — SSE via /api/memo-alerts/stream, fallback polling adattivo (no 20s fisso).
 */
export function subscribeMemoAlerts(callbacks: MemoAlertsStreamCallbacks): () => void {
  const url = "/api/memo-alerts/stream";
  let closed = false;
  let fallbackTimer: ReturnType<typeof setTimeout> | null = null;
  let fallbackMs = MEMO_FALLBACK_POLL_MIN_MS;
  let es: EventSource | null = null;

  const emit = (event: MemoAlertsStreamEvent) => {
    if (!closed) callbacks.onUpdate(event);
  };

  const scheduleFallbackPoll = () => {
    if (closed) return;
    fallbackTimer = setTimeout(async () => {
      if (closed) return;
      try {
        const res = await fetch("/api/memo-alerts", { cache: "no-store" });
        if (res.ok) {
          const data = (await res.json()) as MemoAlertsStreamEvent;
          emit(data);
          fallbackMs = MEMO_FALLBACK_POLL_MIN_MS;
        } else {
          fallbackMs = Math.min(fallbackMs * 1.5, MEMO_FALLBACK_POLL_MAX_MS);
          callbacks.onError?.();
        }
      } catch {
        fallbackMs = Math.min(fallbackMs * 1.5, MEMO_FALLBACK_POLL_MAX_MS);
        callbacks.onError?.();
      }
      scheduleFallbackPoll();
    }, fallbackMs);
  };

  const startFallback = () => {
    if (fallbackTimer) return;
    scheduleFallbackPoll();
  };

  if (typeof EventSource !== "undefined") {
    try {
      es = new EventSource(url);
      es.addEventListener("memo", (ev) => {
        try {
          const data = JSON.parse((ev as MessageEvent).data) as MemoAlertsStreamEvent;
          emit(data);
        } catch {
          /* ignore */
        }
      });
      es.onerror = () => {
        es?.close();
        es = null;
        callbacks.onError?.();
        startFallback();
      };
    } catch {
      startFallback();
    }
  } else {
    startFallback();
  }

  return () => {
    closed = true;
    es?.close();
    if (fallbackTimer) clearTimeout(fallbackTimer);
  };
}
