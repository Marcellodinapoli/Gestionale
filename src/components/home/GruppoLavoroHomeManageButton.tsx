"use client";

import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { Modal } from "@/components/Modal";
import { GruppoEditorPanel } from "@/components/affidi/GruppoEditorPanel";
import type { GruppoEditorData } from "@/lib/gruppoEditor/loadGruppoEditorData";
function HintAffidi({ supervisorName }: { supervisorName: string }) {
  return (
    <p className="mb-3 text-xs text-[var(--muted)]">
      Gli affidi riguardano solo pratiche nei mandati/perimetri assegnati al gruppo e gli operatori
      sotto {supervisorName}.
    </p>
  );
}

export function GruppoLavoroHomeManageButton({
  editor,
  supervisorName,
  canCreateGroup = true,
}: {
  editor: GruppoEditorData;
  supervisorName: string;
  /** Crea nuovo gruppo solo sul proprio profilo supervisor. */
  canCreateGroup?: boolean;
}) {
  const [openCrea, setOpenCrea] = useState(false);
  const [openGestisci, setOpenGestisci] = useState(false);

  return (
    <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
      {canCreateGroup ? (
        <button
          type="button"
          onClick={() => setOpenCrea(true)}
          className="inline-flex items-center gap-1 text-xs font-medium text-[var(--accent)] underline hover:text-[var(--navy)]"
        >
          <Plus className="h-3.5 w-3.5" />
          Crea nuovo gruppo
        </button>
      ) : null}
      <button
        type="button"
        onClick={() => setOpenGestisci(true)}
        className="inline-flex items-center gap-1 text-xs font-medium text-[var(--accent)] underline hover:text-[var(--navy)]"
      >
        <Pencil className="h-3.5 w-3.5" />
        Gestisci gruppo
      </button>

      <Modal open={openCrea} title="Crea nuovo gruppo" onClose={() => setOpenCrea(false)} wide>
        <div className="overflow-y-auto p-4">
          <HintAffidi supervisorName={supervisorName} />
          <p className="mb-3 text-xs text-[var(--navy)]">
            Imposta il nome, aggiungi almeno un operatore, poi mandante e perimetro (obbligatori)
            e clicca <strong>Salva mandanti</strong>.
          </p>
          <GruppoEditorPanel {...editor} mode="create" />
        </div>
      </Modal>

      <Modal
        open={openGestisci}
        title="Gestisci gruppo di lavoro"
        onClose={() => setOpenGestisci(false)}
        wide
      >
        <div className="overflow-y-auto p-4">
          <HintAffidi supervisorName={supervisorName} />
          <GruppoEditorPanel {...editor} mode="manage" />
        </div>
      </Modal>
    </span>
  );
}
