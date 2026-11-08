"use client";

import { useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";
import type { PraticaVistaFaseLimitata } from "@/lib/telephony/inboundPraticaAccesso";

export function PraticaAccessoLimitatoView({
  pratica,
}: {
  pratica: PraticaVistaFaseLimitata;
}) {
  const router = useRouter();

  return (
    <div className="flex min-h-[min(420px,50vh)] flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg rounded-xl border border-[var(--line)] bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-6 w-6 shrink-0 text-amber-600" aria-hidden />
          <div>
            <h1 className="text-lg font-bold text-[var(--navy)]">
              Pratica {pratica.numero}
            </h1>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {pratica.debitore} · {pratica.mandanteCodice}
              {pratica.mandanteRagioneSociale
                ? ` · ${pratica.mandanteRagioneSociale}`
                : ""}
            </p>
          </div>
        </div>
        <p className="text-sm leading-relaxed text-[var(--navy)]">
          <span className="font-semibold">Fase attuale · </span>
          {pratica.faseDescrizione}
        </p>
        <p className="mt-4 text-xs text-[var(--muted)]">
          La scheda di lavorazione non è disponibile per il tuo profilo. Puoi gestire la
          chiamata con i dati del popup inbound.
        </p>
        <div className="mt-6">
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex h-9 items-center rounded-lg bg-[var(--navy)] px-4 text-sm font-semibold text-white hover:bg-[#1a365d]"
          >
            Torna indietro
          </button>
        </div>
      </div>
    </div>
  );
}
