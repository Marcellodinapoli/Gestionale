"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Card } from "@/components/ui";
import {
  ImportForm,
  type LottoEsistenteOption,
  type MandanteImportOption,
} from "@/components/ImportForm";

type Prefill = {
  mandanteId: string;
  perimetro: string;
  lotto: string;
  affidoIl: string;
  scadenzaMandato?: string | null;
} | null;

export function ImportPanels({
  mandanti,
  lottiEsistenti,
  prefill,
  integraId,
}: {
  mandanti: MandanteImportOption[];
  lottiEsistenti: LottoEsistenteOption[];
  prefill: Prefill;
  integraId: string;
}) {
  const [open, setOpen] = useState<"pratiche" | "incassi" | null>(
    prefill ? "pratiche" : null
  );

  useEffect(() => {
    if (prefill) setOpen("pratiche");
  }, [
    prefill?.mandanteId,
    prefill?.perimetro,
    prefill?.lotto,
    prefill?.affidoIl,
    prefill?.scadenzaMandato,
  ]);

  return (
    <div className="space-y-4 lg:col-span-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setOpen("pratiche")}
          className={`inline-flex h-10 items-center gap-1.5 rounded-lg px-4 text-sm font-semibold ${
            open === "pratiche"
              ? "bg-[var(--navy)] text-white"
              : "border border-[var(--line)] bg-white text-[var(--navy)] hover:bg-slate-50"
          }`}
        >
          <Plus className="h-4 w-4" />
          Nuova importazione lotti
        </button>
        <button
          type="button"
          onClick={() => setOpen("incassi")}
          className={`inline-flex h-10 items-center gap-1.5 rounded-lg px-4 text-sm font-semibold ${
            open === "incassi"
              ? "bg-[var(--navy)] text-white"
              : "border border-[var(--line)] bg-white text-[var(--navy)] hover:bg-slate-50"
          }`}
        >
          <Plus className="h-4 w-4" />
          Nuova importazione incassi
        </button>
      </div>

      {open === "pratiche" ? (
        <div className="max-w-xl">
          <Card title="Pratiche">
            <ImportForm
              key={prefill ? `integra-${integraId}` : "pratiche-nuovo"}
              kind="pratiche"
              buttonLabel="Importa pratiche"
              mandanti={mandanti}
              lottiEsistenti={lottiEsistenti}
              prefill={prefill}
              onClose={() => setOpen(null)}
            />
          </Card>
        </div>
      ) : null}

      {open === "incassi" ? (
        <div className="max-w-xl">
          <Card title="Incassi massivi">
            <ImportForm
              kind="incassi"
              buttonLabel="Importa incassi"
              mandanti={mandanti}
              onClose={() => setOpen(null)}
            />
          </Card>
        </div>
      ) : null}
    </div>
  );
}
