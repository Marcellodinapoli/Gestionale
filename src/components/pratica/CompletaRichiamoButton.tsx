"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { clearMemoPraticaAction } from "@/actions/core";

export function CompletaRichiamoButton({
  praticaId,
  label = "Richiamo effettuato",
  className,
  onCleared,
}: {
  praticaId: string;
  label?: string;
  className?: string;
  onCleared?: () => void;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onClick() {
    setPending(true);
    try {
      const fd = new FormData();
      fd.set("praticaId", praticaId);
      await clearMemoPraticaAction(fd);
      onCleared?.();
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => void onClick()}
      className={
        className ||
        "h-8 rounded border border-[var(--line)] bg-white px-3 text-xs font-medium text-[#132033] hover:bg-slate-50 disabled:opacity-60"
      }
    >
      {pending ? "…" : label}
    </button>
  );
}
