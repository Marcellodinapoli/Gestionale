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

  async function onSubmit(formData: FormData) {
    setPending(true);
    try {
      await clearMemoPraticaAction(formData);
      onCleared?.();
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <form action={onSubmit}>
      <input type="hidden" name="praticaId" value={praticaId} />
      <button
        type="submit"
        disabled={pending}
        className={
          className ||
          "h-8 rounded border border-[var(--line)] bg-white px-3 text-xs font-medium text-[#132033] hover:bg-slate-50 disabled:opacity-60"
        }
      >
        {pending ? "…" : label}
      </button>
    </form>
  );
}
