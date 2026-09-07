"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { FILTRI_RESET_BUTTON_CLASS } from "@/components/filtri/filtriFieldStyles";

export function ProvvigioniAggiornaButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => router.refresh())}
      className={`inline-flex h-10 items-center gap-1.5 ${FILTRI_RESET_BUTTON_CLASS} disabled:opacity-60`}
      title="Ricarica i dati della pagina"
    >
      <RefreshCw className={`h-3.5 w-3.5 ${pending ? "animate-spin" : ""}`} />
      {pending ? "Aggiornamento…" : "Aggiorna"}
    </button>
  );
}
