"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { subscribeLock } from "@/lib/realtime/RealtimeService";
import { PRATICA_LOCK_HEARTBEAT_MS } from "@/lib/data/contracts/lock";

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

    if (owned) {
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

      heartbeat();
      const intervalId = window.setInterval(heartbeat, PRATICA_LOCK_HEARTBEAT_MS);
      window.addEventListener("pagehide", release);

      return () => {
        unsub();
        window.clearInterval(intervalId);
        window.removeEventListener("pagehide", release);
        release();
      };
    }

    return unsub;
  }, [praticaId, owned, router]);

  return null;
}
