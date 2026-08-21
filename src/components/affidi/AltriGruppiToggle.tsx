"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

type GruppoInfo = {
  id: string;
  name: string;
  gruppoNome: string | null;
  operators: Array<{ id: string; name: string }>;
};

export function AltriGruppiToggle({ gruppi }: { gruppi: GruppoInfo[] }) {
  const [aperto, setAperto] = useState(false);

  return (
    <div className="rounded-lg border border-[var(--line)] bg-[#f8fafc]">
      <button
        type="button"
        onClick={() => setAperto((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-2 text-left text-xs font-semibold text-[var(--navy)] hover:bg-[#eef4f8]"
      >
        {aperto ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0" />
        )}
        Altri gruppi di lavoro ({gruppi.length})
      </button>
      {aperto ? (
        <div className="space-y-2 border-t border-[var(--line)] p-3">
          {gruppi.map((sup) => (
            <div
              key={sup.id}
              className="rounded-lg border border-[var(--line)] bg-white p-3"
            >
              <div className="flex items-baseline gap-2">
                {sup.gruppoNome ? (
                  <p className="text-sm font-semibold text-[var(--navy)]">
                    {sup.gruppoNome}
                  </p>
                ) : (
                  <p className="text-sm italic text-[var(--muted)]">
                    Nome non assegnato
                  </p>
                )}
                <span className="text-[10px] text-[var(--muted)]">
                  Supervisor: {sup.name}
                </span>
              </div>
              {sup.operators.length > 0 ? (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {sup.operators.map((op) => (
                    <span
                      key={op.id}
                      className="rounded-full border border-[var(--line)] bg-[#eef4f8] px-2.5 py-0.5 text-xs"
                    >
                      {op.name}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-1 text-[10px] text-[var(--muted)]">
                  Nessun operatore nel gruppo
                </p>
              )}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
