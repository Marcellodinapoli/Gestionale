"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { PERF_COLLECTOR } from "@/lib/performance/thresholds";
import type { PerfEventInput } from "@/lib/performance/types";
import {
  pathOnlyFromUrl,
  takePendingNavigation,
} from "@/lib/performance/navTimingBridge";

type QueueEvent = PerfEventInput & { timestamp: string };

function newSessionId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  }
}

function readSessionId(): string {
  try {
    const existing = sessionStorage.getItem(PERF_COLLECTOR.storageKey);
    if (existing && /^[a-zA-Z0-9_-]{8,80}$/.test(existing)) return existing;
    const id = newSessionId();
    sessionStorage.setItem(PERF_COLLECTOR.storageKey, id);
    return id;
  } catch {
    return newSessionId();
  }
}

const PERF_START_EMITTED_KEY = "credixa_perf_start_emitted";
/** Fallback se sessionStorage non è utilizzabile. */
let startEmittedSidMemory: string | null = null;

function hasEmittedSessionStart(sid: string): boolean {
  try {
    return sessionStorage.getItem(PERF_START_EMITTED_KEY) === sid;
  } catch {
    return startEmittedSidMemory === sid;
  }
}

function markSessionStartEmitted(sid: string): void {
  try {
    sessionStorage.setItem(PERF_START_EMITTED_KEY, sid);
  } catch {
    /* ignore */
  }
  startEmittedSidMemory = sid;
}

function pathOnly(href: string): string {
  try {
    if (href.startsWith("http")) return new URL(href).pathname;
  } catch {
    /* ignore */
  }
  return href.split("?")[0]?.split("#")[0] || href;
}

/**
 * Collector leggero: montare SOLO se PerfMonitoringEnabled=true (server).
 * Se enabled=false non viene renderizzato → overhead nullo.
 */
export function PerfMonitor({ enabled }: { enabled: boolean }) {
  const pathname = usePathname();
  const queueRef = useRef<QueueEvent[]>([]);
  const sessionIdRef = useRef<string>("");
  const prevPathRef = useRef<string | null>(null);
  const navStartRef = useRef<number>(0);
  const lastActivityRef = useRef<number>(0);
  const flushingRef = useRef(false);
  const endedRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    sessionIdRef.current = readSessionId();
    endedRef.current = false;
    navStartRef.current = performance.now();
    lastActivityRef.current = Date.now();

    const sid = sessionIdRef.current;

    void fetch("/api/performance/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: sid,
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      }),
      credentials: "same-origin",
      keepalive: true,
    }).catch(() => {
      /* non bloccare */
    });

    function enqueue(ev: PerfEventInput) {
      if (endedRef.current) return;
      lastActivityRef.current = Date.now();
      queueRef.current.push({
        ...ev,
        timestamp: ev.timestamp || new Date().toISOString(),
      });
      if (queueRef.current.length >= PERF_COLLECTOR.maxBatchSize) {
        void flush();
      }
    }

    async function flush() {
      if (flushingRef.current) return;
      const batch = queueRef.current.splice(0, PERF_COLLECTOR.maxBatchSize);
      if (!batch.length) return;
      flushingRef.current = true;
      try {
        const res = await fetch("/api/performance/events", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            [PERF_COLLECTOR.headerSession]: sessionIdRef.current,
          },
          body: JSON.stringify({
            sessionId: sessionIdRef.current,
            events: batch,
          }),
          credentials: "same-origin",
          keepalive: true,
        });
        if (!res.ok && res.status >= 500) {
          // retry leggero: re-accoda una volta
          queueRef.current.unshift(...batch);
        }
      } catch {
        queueRef.current.unshift(...batch.slice(0, PERF_COLLECTOR.maxBatchSize));
      } finally {
        flushingRef.current = false;
      }
    }

    function endSession() {
      if (endedRef.current) return;
      endedRef.current = true;
      enqueue({
        type: "SESSION",
        action: "end",
        name: "session_end",
        route: prevPathRef.current,
      });
      void flush();
      void fetch("/api/performance/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: sessionIdRef.current, ended: true }),
        credentials: "same-origin",
        keepalive: true,
      }).catch(() => {
        /* ignore */
      });
    }

    // --- fetch interceptor (API same-origin, esclude /api/performance) ---
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      const method = (
        init?.method ||
        (typeof input !== "string" && !(input instanceof URL) ? input.method : "GET") ||
        "GET"
      ).toUpperCase();
      const path = pathOnly(url);
      const isAppApi =
        path.startsWith("/api/") && !path.startsWith("/api/performance");
      const isSameOrigin =
        path.startsWith("/") ||
        (typeof window !== "undefined" && url.startsWith(window.location.origin));

      if (!isAppApi || !isSameOrigin) {
        return originalFetch(input, init);
      }

      const headers = new Headers(
        init?.headers ||
          (typeof input !== "string" && !(input instanceof URL)
            ? input.headers
            : undefined)
      );
      headers.set(PERF_COLLECTOR.headerSession, sessionIdRef.current);

      const started = performance.now();
      try {
        const res = await originalFetch(input, { ...init, headers });
        enqueue({
          type: "API",
          route: path,
          action: method,
          name: path,
          durationMs: Math.round(performance.now() - started),
          status: String(res.status),
          metadata: { ok: res.ok },
        });
        return res;
      } catch (err) {
        enqueue({
          type: "API",
          route: path,
          action: method,
          name: path,
          durationMs: Math.round(performance.now() - started),
          status: "network_error",
          metadata: { ok: false },
        });
        throw err;
      }
    };

    // --- azioni significative (submit form, click data-perf-action / bottoni primaria) ---
    function onClick(ev: MouseEvent) {
      const t = ev.target as HTMLElement | null;
      if (!t) return;
      const actionEl = t.closest<HTMLElement>(
        "[data-perf-action], button[type='submit'], a[href]"
      );
      if (!actionEl) return;
      const explicit = actionEl.getAttribute("data-perf-action");
      if (explicit) {
        enqueue({
          type: "ACTION",
          action: explicit,
          name: explicit,
          route: prevPathRef.current || pathname,
        });
        return;
      }
      if (actionEl.tagName === "BUTTON" && actionEl.getAttribute("type") === "submit") {
        const form = actionEl.closest("form");
        const formName =
          form?.getAttribute("name") ||
          form?.getAttribute("data-perf-action") ||
          "form_submit";
        enqueue({
          type: "ACTION",
          action: "submit",
          name: formName.slice(0, 80),
          route: prevPathRef.current || pathname,
        });
      }
    }

    function onSubmit(ev: Event) {
      const form = ev.target as HTMLFormElement | null;
      if (!form) return;
      const name =
        form.getAttribute("data-perf-action") ||
        form.getAttribute("name") ||
        form.getAttribute("id") ||
        "form_submit";
      enqueue({
        type: "ACTION",
        action: "submit",
        name: String(name).slice(0, 80),
        route: prevPathRef.current || pathname,
      });
    }

    function onError(ev: ErrorEvent) {
      enqueue({
        type: "ERROR",
        name: "window_error",
        route: prevPathRef.current || pathname,
        action: "error",
        metadata: {
          message: String(ev.message || "error").slice(0, 200),
        },
      });
    }

    function onRejection(ev: PromiseRejectionEvent) {
      const reason = ev.reason;
      const message =
        reason instanceof Error
          ? reason.message
          : typeof reason === "string"
            ? reason
            : "unhandledrejection";
      enqueue({
        type: "ERROR",
        name: "unhandledrejection",
        route: prevPathRef.current || pathname,
        action: "error",
        metadata: { message: String(message).slice(0, 200) },
      });
    }

    function onVisibility() {
      if (document.visibilityState === "hidden") {
        void flush();
      }
    }

    function onPageHide() {
      void flush();
    }

    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);

    const flushTimer = window.setInterval(() => {
      void flush();
      if (Date.now() - lastActivityRef.current > PERF_COLLECTOR.inactivityEndMs) {
        endSession();
      }
    }, PERF_COLLECTOR.flushIntervalMs);

    if (!hasEmittedSessionStart(sid)) {
      enqueue({
        type: "SESSION",
        action: "start",
        name: "session_start",
        route: pathname,
      });
      markSessionStartEmitted(sid);
    }

    return () => {
      void flush();
      window.fetch = originalFetch;
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      window.clearInterval(flushTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once when enabled
  }, [enabled]);

  // Navigazione: DWELL = permanenza sulla route uscente;
  // PAGE = destinazione (durationMs solo se pending da onRouterTransitionStart).
  useEffect(() => {
    if (!enabled) return;
    const prev = prevPathRef.current;
    const next = pathname || "/";
    if (prev === next) return;

    const dwellMs = Math.round(performance.now() - navStartRef.current);
    navStartRef.current = performance.now();
    lastActivityRef.current = Date.now();
    const ts = new Date().toISOString();

    if (prev != null) {
      queueRef.current.push({
        type: "DWELL",
        action: "leave",
        name: prev,
        route: prev,
        durationMs: dwellMs,
        timestamp: ts,
        metadata: { from: prev, to: next },
      });

      const pending = takePendingNavigation();
      const pendingPath = pending ? pathOnlyFromUrl(pending.url) : null;
      const matches =
        pending != null && pendingPath != null && pendingPath === next;
      const durationMs = matches
        ? Math.round(performance.now() - pending!.t0)
        : null;

      queueRef.current.push({
        type: "PAGE",
        action: "navigate",
        name: next,
        route: next,
        ...(durationMs != null ? { durationMs } : {}),
        timestamp: ts,
        metadata: { from: prev, to: next },
      });
    } else {
      queueRef.current.push({
        type: "PAGE",
        action: "load",
        name: next,
        route: next,
        timestamp: ts,
      });
    }
    prevPathRef.current = next;
  }, [enabled, pathname]);

  return null;
}
