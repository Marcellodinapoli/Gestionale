"use client";

import { useState } from "react";
import { assignPraticaAction } from "@/actions/assignPratica";
import { TipoAffidoSelect } from "@/components/affidi/TipoAffidoSelect";

export function AffidaForm({
  praticaId,
  operatori,
  defaultAssegnatarioId,
  allowNone,
  showRipristina,
  titolareName,
  submitLabel = "Affida",
  hideTipoAffido,
}: {
  praticaId: string;
  operatori: Array<{ id: string; name: string }>;
  defaultAssegnatarioId?: string;
  allowNone?: boolean;
  showRipristina?: boolean;
  titolareName?: string | null;
  submitLabel?: string;
  hideTipoAffido?: boolean;
}) {
  const [tipo, setTipo] = useState("definitivo");
  const ripristina = !hideTipoAffido && tipo === "ripristina";

  return (
    <form action={assignPraticaAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="praticaId" value={praticaId} />
      {hideTipoAffido ? (
        <input type="hidden" name="tipoAffido" value="definitivo" />
      ) : (
        <TipoAffidoSelect showRipristina={showRipristina} onChange={setTipo} />
      )}
      {!ripristina ? (
        <select
          name="assegnatarioId"
          required={!allowNone}
          defaultValue={defaultAssegnatarioId || ""}
          className="h-9 min-w-[160px] flex-1 rounded-lg border border-[var(--line)] px-2 text-sm"
        >
          {allowNone ? <option value="">— nessuno —</option> : null}
          {operatori.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      ) : null}
      <button
        type="submit"
        className="rounded-lg bg-[var(--navy)] px-3 text-sm text-white"
      >
        {ripristina ? "Ripristina" : submitLabel}
      </button>
      {showRipristina && titolareName ? (
        <span className="w-full text-xs text-[var(--muted)]">
          Titolare: {titolareName}
        </span>
      ) : null}
    </form>
  );
}
