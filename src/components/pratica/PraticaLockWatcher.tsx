"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { subscribeLock } from "@/lib/realtime/RealtimeService";
import { PRATICA_LOCK_HEARTBEAT_MS } from "@/lib/data/contracts/lock";

/**
 * Strict Mode (e remount sync) monta → cleanup → rimonta subito.
 * Un release immediato nel cleanup toglie il lock appena preso in SSR
 * e fa partire due POST in corsa (a volte 500).
 * Contiamo i holder e differiamo il DELETE di pochi ms così il remount lo annulla.
 */
const holders = new Map<string, number>();
const pendingRelease = new Map<string, ReturnType<typeof setTimeout>>();

function cancelPendingRelease(praticaId: string) {
  const t = pendingRelease.get(praticaId);
  if (t != null) {
    clearTimeout(t);
    pendingRelease.delete(praticaId);
  }
}

export function PraticaLockWatcher({
  praticaId,
  owned,
}: {
  praticaId: string;
  owned: boolean;
}) {
  const router = useRouter();

  useEffect(() => {
    const url = `/api/pratiche/${praticaId}/lock`;

    const unsub = subscribeLock(praticaId, {
      onUpdate: (ev) => {
        if (owned && !ev.owned) router.refresh();
        if (!owned && !ev.lockedByName) router.refresh();
      },
    });

    if (!owned) {
      return unsub;
    }

    cancelPendingRelease(praticaId);
    const nextHolders = (holders.get(praticaId) ?? 0) + 1;
    holders.set(praticaId, nextHolders);

    function heartbeat() {
      fetch(url, { method: "POST" })
        .then((res) => (res.ok ? res.json() : null))
        .then((data: { owned?: boolean } | null) => {
          if (data && data.owned === false) router.refresh();
        })
        .catch(() => {});
    }

    function release() {
      fetch(url, { method: "DELETE", keepalive: true }).catch(() => {});
    }

    // Il lock è già preso in SSR (getPraticaWorkContext).
    // Evita POST immediato: parte solo l'intervallo (e un solo holder avvia il timer).
    let intervalId: number | undefined;
    if (nextHolders === 1) {
      intervalId = window.setInterval(heartbeat, PRATICA_LOCK_HEARTBEAT_MS);
    }

    function onPageHide() {
      cancelPendingRelease(praticaId);
      holders.delete(praticaId);
      if (intervalId != null) window.clearInterval(intervalId);
      release();
    }
    window.addEventListener("pagehide", onPageHide);

    return () => {
      unsub();
      window.removeEventListener("pagehide", onPageHide);
      if (intervalId != null) window.clearInterval(intervalId);

      const left = (holders.get(praticaId) ?? 1) - 1;
      if (left > 0) {
        holders.set(praticaId, left);
        return;
      }
      holders.delete(praticaId);

      // Differisci: Strict Mode rimonta nello stesso tick e annulla il DELETE.
      cancelPendingRelease(praticaId);
      const t = setTimeout(() => {
        pendingRelease.delete(praticaId);
        if ((holders.get(praticaId) ?? 0) === 0) {
          release();
        }
      }, 80);
      pendingRelease.set(praticaId, t);
    };
  }, [praticaId, owned, router]);

  return null;
}
