"use client";

import { useEffect, useState } from "react";
import {
  TEXT_FILTER_OPS,
  parseTextFilterOp,
  type TextFilterOp,
} from "@/lib/filtriTestoOp";
import {
  AGGIUNTIVO_CAMPI,
  AGGIUNTIVO_GRUPPI,
  aggiuntivoValoreInputType,
  aggiuntivoValorePlaceholder,
} from "@/lib/filtriAggiuntivoUi";
import { FILTRI_FIELD_CLASS } from "@/components/filtri/filtriFieldStyles";

const selectCls =
  "h-9 min-w-0 max-w-[9rem] shrink-0 border-0 bg-transparent px-1 text-sm text-[var(--navy)]";
const inputCls =
  "h-full min-w-0 flex-1 border-0 bg-transparent px-2 text-sm text-[var(--navy)] placeholder:text-[var(--muted)]";

export function AggiuntivoFiltroControls({
  campo,
  valore,
  op,
  onCampoChange,
  onValoreChange,
  onOpChange,
  campoName = "aggiuntivoCampo",
  valoreName = "aggiuntivoValore",
  opName = "aggiuntivoOp",
  fieldClass,
  placeholder,
}: {
  campo?: string;
  valore?: string;
  op?: TextFilterOp | string;
  onCampoChange?: (value: string) => void;
  onValoreChange?: (value: string) => void;
  onOpChange?: (value: TextFilterOp) => void;
  campoName?: string;
  valoreName?: string;
  opName?: string;
  fieldClass?: string;
  placeholder?: string;
}) {
  const opControlled = onOpChange !== undefined;
  const campoControlled = onCampoChange !== undefined;
  const valoreControlled = onValoreChange !== undefined;

  const [localCampo, setLocalCampo] = useState(campo ?? "");
  const [localOp, setLocalOp] = useState<TextFilterOp>(() => parseTextFilterOp(op));

  useEffect(() => {
    setLocalCampo(campo ?? "");
  }, [campo]);

  useEffect(() => {
    setLocalOp(parseTextFilterOp(op));
  }, [op]);

  const campoEff = campoControlled ? (campo ?? "") : localCampo;
  const opEff = opControlled ? parseTextFilterOp(op) : localOp;
  const hasCampo = Boolean(campoEff.trim());
  const valorePlaceholder =
    placeholder ?? aggiuntivoValorePlaceholder(campoEff, opEff);
  const valoreInputType = aggiuntivoValoreInputType(campoEff);

  return (
    <div
      className={`flex min-w-0 items-center gap-1 ${fieldClass ?? FILTRI_FIELD_CLASS}`}
    >
      <select
        name={campoControlled ? undefined : campoName}
        value={campoControlled ? campo ?? "" : undefined}
        defaultValue={campoControlled ? undefined : campo ?? ""}
        onChange={(e) => {
          const next = e.target.value;
          if (!campoControlled) setLocalCampo(next);
          onCampoChange?.(next);
        }}
        className={selectCls}
        aria-label="Campo aggiuntivo"
      >
        <option value="">— Campo —</option>
        {AGGIUNTIVO_GRUPPI.map((g) => (
          <optgroup key={g.id} label={g.label}>
            {AGGIUNTIVO_CAMPI.filter((c) => c.gruppo === g.id).map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <span className="text-[var(--muted)]">|</span>
      <select
        name={opControlled ? undefined : opName}
        value={opControlled ? opEff : undefined}
        defaultValue={opControlled ? undefined : opEff}
        disabled={!hasCampo}
        onChange={(e) => {
          const next = parseTextFilterOp(e.target.value);
          if (!opControlled) setLocalOp(next);
          onOpChange?.(next);
        }}
        className="h-9 min-w-[2.75rem] shrink-0 rounded border-0 bg-transparent px-1 text-sm font-semibold disabled:opacity-50"
        aria-label="Operatore filtro aggiuntivo"
      >
        {TEXT_FILTER_OPS.map((o) => (
          <option key={o.value} value={o.value} title={o.title}>
            {o.label}
          </option>
        ))}
      </select>
      <span className="text-[var(--muted)]">|</span>
      <input
        type={valoreInputType}
        name={valoreControlled ? undefined : valoreName}
        value={valoreControlled ? valore ?? "" : undefined}
        defaultValue={valoreControlled ? undefined : valore ?? ""}
        disabled={!hasCampo}
        onChange={onValoreChange ? (e) => onValoreChange(e.target.value) : undefined}
        placeholder={valorePlaceholder}
        step={valoreInputType === "number" ? "0.01" : undefined}
        className={`${inputCls} disabled:opacity-50`}
        aria-label="Valore campo aggiuntivo"
      />
    </div>
  );
}
