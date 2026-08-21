"use client";

import { useEffect } from "react";
import { usePraticaHeaderSlot } from "@/components/layout/PraticaHeaderSlot";
import { StatoPraticaBar } from "@/components/pratica/StatoPraticaBar";

export function PraticaStatoHeaderBridge({
  praticaId,
  stato,
  promessaAt,
  canEdit,
}: {
  praticaId: string;
  stato: string;
  promessaAt?: string | null;
  canEdit: boolean;
}) {
  const { setSlot } = usePraticaHeaderSlot();

  useEffect(() => {
    setSlot(
      <StatoPraticaBar
        praticaId={praticaId}
        stato={stato}
        promessaAt={promessaAt}
        canEdit={canEdit}
        compact
        header
      />
    );
    return () => setSlot(null);
  }, [praticaId, stato, promessaAt, canEdit, setSlot]);

  return null;
}
