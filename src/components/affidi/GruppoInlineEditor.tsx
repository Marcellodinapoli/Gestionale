"use client";

import { useState } from "react";
import Link from "next/link";
import { Pencil, X } from "lucide-react";
import { AltriGruppiToggle } from "./AltriGruppiToggle";
import { GruppoEditorPanel } from "./GruppoEditorPanel";
import type {
  GruppoInfoAltro,
  MandanteOptionGruppo,
  OperatoreAnagraficaGruppo,
} from "@/lib/gruppoEditor/types";
import {
  etichettaGruppoMandanti,
  type GruppoMandanteAssegnazione,
} from "@/lib/gruppoMandantiUi";

export function GruppoInlineEditor({
  supervisorId,
  membri,
  tuttiOperatori,
  gruppoNome,
  gruppoMandanti,
  mandanti,
  altriGruppi,
}: {
  supervisorId: string;
  membri: Array<{ id: string; name: string; role: string }>;
  tuttiOperatori: OperatoreAnagraficaGruppo[];
  gruppoNome?: string | null;
  gruppoMandanti: GruppoMandanteAssegnazione[];
  mandanti: MandanteOptionGruppo[];
  altriGruppi: GruppoInfoAltro[];
}) {
  const [aperto, setAperto] = useState(false);

  const nelGruppo = new Set(
    membri.filter((m) => m.role === "OPERATOR").map((m) => m.id)
  );
  const operatoriGruppo = tuttiOperatori.filter((o) => nelGruppo.has(o.id));
  const etichetteMandanti = etichettaGruppoMandanti(gruppoMandanti, mandanti);

  return (
    <div className="mb-3">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--line)] bg-[#eef4f8] px-3 py-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
          {gruppoNome ? (
            <span className="text-xs font-semibold text-[var(--navy)]">{gruppoNome}</span>
          ) : null}
          <span className="text-[10px] text-[var(--muted)]">
            {operatoriGruppo.length} operatori
          </span>
          {etichetteMandanti.length ? (
            <div className="flex flex-wrap gap-1">
              {etichetteMandanti.map((label) => (
                <span
                  key={label}
                  className="rounded-full border border-[#c5d4e3] bg-white px-2 py-px text-[10px] text-[var(--navy)]"
                >
                  {label}
                </span>
              ))}
            </div>
          ) : null}
          <div className="flex flex-wrap gap-1">
            {operatoriGruppo.map((o) => (
              <Link
                key={o.id}
                href={`/affidi?operatore=${o.id}`}
                className="rounded-full border border-[var(--line)] bg-white px-2 py-px text-[10px] hover:bg-[#dceaf3] hover:border-[var(--accent)]"
                title={`Filtra su ${o.name}`}
              >
                {o.name}
              </Link>
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setAperto((v) => !v)}
          className="flex shrink-0 items-center gap-1 rounded border border-[var(--navy)] bg-[var(--navy)] px-2 py-1 text-[10px] font-semibold text-white hover:bg-[#1a365d]"
        >
          {aperto ? (
            <>
              <X className="h-3 w-3" /> Chiudi
            </>
          ) : (
            <>
              <Pencil className="h-3 w-3" /> Modifica gruppo
            </>
          )}
        </button>
      </div>

      {aperto ? (
        <div className="mt-2 space-y-3 rounded-lg border border-dashed border-[var(--accent)] bg-white p-3">
          <GruppoEditorPanel
            supervisorId={supervisorId}
            membri={membri}
            tuttiOperatori={tuttiOperatori}
            gruppoNome={gruppoNome}
            gruppoMandanti={gruppoMandanti}
            mandanti={mandanti}
            altriGruppi={altriGruppi}
          />
        </div>
      ) : null}
    </div>
  );
}
