"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/Modal";
import { AltriFiltriFormBody } from "@/components/filtri/AltriFiltriFormBody";
import type { AltriFiltri } from "@/lib/praticheAltriFiltriUi";

export function LavorazioneVoceFiltriModal({
  open,
  onClose,
  value,
  onApply,
  operatori,
  mandanti,
  lotti,
}: {
  open: boolean;
  onClose: () => void;
  value: AltriFiltri;
  onApply: (next: AltriFiltri) => void;
  operatori?: Array<{ id: string; name: string }>;
  mandanti?: Array<{ id: string; codice: string; ragioneSociale: string }>;
  lotti?: string[];
}) {
  const [draft, setDraft] = useState<AltriFiltri>(value);

  useEffect(() => {
    if (open) setDraft(value);
  }, [open, value]);

  return (
    <Modal open={open} title="Filtro lavorazione" onClose={onClose} wide>
      <div className="space-y-4 p-4">
        <p className="text-xs text-[var(--muted)]">
          Definisci quali pratiche includere in questa riga. Stessi criteri dell&apos;elenco pratiche
          («Altri filtri»).
        </p>
        <AltriFiltriFormBody
          value={draft}
          onChange={setDraft}
          operatori={operatori}
          mandanti={mandanti}
          lotti={lotti}
        />
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--line)] pt-3">
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-lg border border-[var(--line)] bg-white px-4 text-sm hover:bg-[#eef4f8]"
          >
            Annulla
          </button>
          <button
            type="button"
            onClick={() => setDraft({})}
            className="h-9 rounded-lg border border-[var(--danger)]/30 bg-[#fef2f2] px-4 text-sm text-[var(--danger)] hover:bg-[#fee2e2]"
          >
            Azzera
          </button>
          <button
            type="button"
            onClick={() => {
              onApply(draft);
              onClose();
            }}
            className="h-9 rounded-lg bg-[var(--navy)] px-4 text-sm font-semibold text-white hover:opacity-90"
          >
            Applica filtro
          </button>
        </div>
      </div>
    </Modal>
  );
}
