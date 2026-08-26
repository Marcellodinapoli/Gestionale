"use client";

import { useEffect } from "react";
import { usePraticaHeaderSlot } from "@/components/layout/PraticaHeaderSlot";
import { StatoPraticaBar } from "@/components/pratica/StatoPraticaBar";

export function PraticaStatoHeaderBridge({
  praticaId,
  stato,
  filtroStato,
  promessaAt,
  canEdit,
}: {
  praticaId: string;
  stato: string;
  filtroStato?: string | null;
  promessaAt?: string | null;
  canEdit: boolean;
}) {
  const { setSlot } = usePraticaHeaderSlot();

  useEffect(() => {
    setSlot(
      <StatoPraticaBar
        praticaId={praticaId}
        stato={stato}
        filtroStato={filtroStato}
        promessaAt={promessaAt}
        canEdit={canEdit}
        compact
        header
      />
    );
    return () => setSlot(null);
  }, [praticaId, stato, filtroStato, promessaAt, canEdit, setSlot]);

  return null;
}
