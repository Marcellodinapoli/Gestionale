"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const HEARTBEAT_MS = 15_000;

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
      const intervalId = window.setInterval(heartbeat, HEARTBEAT_MS);
      window.addEventListener("pagehide", release);

      return () => {
        window.clearInterval(intervalId);
        window.removeEventListener("pagehide", release);
        release();
      };
    }

    function poll() {
      fetch(url)
        .then((res) => (res.ok ? res.json() : null))
        .then((data: { lockedByName?: string | null } | null) => {
          if (data && !data.lockedByName) router.refresh();
        })
        .catch(() => {});
    }

    const intervalId = window.setInterval(poll, HEARTBEAT_MS);
    return () => window.clearInterval(intervalId);
  }, [praticaId, owned, router]);

  return null;
}
