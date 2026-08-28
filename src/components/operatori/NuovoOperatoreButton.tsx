"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Modal } from "@/components/Modal";
import { NuovoOperatoreForm } from "@/components/operatori/NuovoOperatoreForm";
import type { Role } from "@/lib/permissions";

type SedeOpt = { id: string; nome: string };
type SupervisorOpt = { id: string; name: string };

export function NuovoOperatoreButton({
  creatorRole,
  sedi,
  supervisori,
}: {
  creatorRole: Role;
  sedi: SedeOpt[];
  supervisori: SupervisorOpt[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[var(--navy)] px-3 text-sm font-semibold text-white hover:opacity-90"
      >
        <Plus className="h-4 w-4" />
        Crea nuovo operatore
      </button>

      <Modal
        open={open}
        title="Nuovo operatore"
        wide
        onClose={() => setOpen(false)}
      >
        <div className="p-4">
          <NuovoOperatoreForm
            key={open ? "open" : "closed"}
            creatorRole={creatorRole}
            sedi={sedi}
            supervisori={supervisori}
            onSuccess={() => {
              setOpen(false);
              router.refresh();
            }}
            onCancel={() => setOpen(false)}
          />
        </div>
      </Modal>
    </>
  );
}
