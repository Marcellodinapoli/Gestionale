"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  OPERATORE_FILTER_OPS,
  joinOperatoreList,
  parseOperatoreList,
  parseOperatoreOp,
  type OperatoreFiltroOp,
  type OperatoreFiltroOption,
  codiceOperatoreFiltro,
} from "@/lib/filtriOperatore";
import { FILTRI_FIELD_CLASS } from "@/components/filtri/filtriFieldStyles";

export function OperatoreFiltroControls({
  operatore,
  operatoreOp,
  onOperatoreChange,
  onOperatoreOpChange,
  opName = "operatoreOp",
  fieldName = "operatore",
  fieldClass,
  operatori = [],
  disabled,
}: {
  operatore?: string;
  operatoreOp?: OperatoreFiltroOp | string;
  onOperatoreChange?: (ids: string[]) => void;
  onOperatoreOpChange?: (value: OperatoreFiltroOp) => void;
  opName?: string;
  fieldName?: string;
  fieldClass?: string;
  operatori?: OperatoreFiltroOption[];
  disabled?: boolean;
}) {
  const op = parseOperatoreOp(operatoreOp);
  const controlled = Boolean(onOperatoreChange);
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>(() => parseOperatoreList(operatore));

  useEffect(() => {
    setSelected(parseOperatoreList(operatore));
  }, [operatore]);

  useEffect(() => {
    const allowed = new Set(operatori.map((o) => o.id));
    setSelected((prev) => {
      const filtered = prev.filter((id) => allowed.has(id));
      if (filtered.length !== prev.length) {
        onOperatoreChange?.(filtered);
        return filtered;
      }
      return prev;
    });
  }, [operatori, onOperatoreChange]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const joined = joinOperatoreList(selected);
  const canSelect = !disabled && operatori.length > 0;

  function applySelected(next: string[]) {
    setSelected(next);
    onOperatoreChange?.(next);
  }

  function toggle(id: string, checked: boolean) {
    const set = new Set(selected);
    if (checked) set.add(id);
    else set.delete(id);
    applySelected([...set]);
  }

  const riepilogo = selected.length
    ? `${selected.length} operator${selected.length === 1 ? "e" : "i"} selezionat${selected.length === 1 ? "o" : "i"}`
    : disabled
      ? "Non disponibile per il tuo profilo"
      : "Seleziona uno o più codici operatore";

  return (
    <div ref={rootRef} className="relative min-w-0">
      <div
        className={`flex min-w-0 items-center gap-1 ${fieldClass ?? FILTRI_FIELD_CLASS}`}
        title="Codice operatore"
      >
        <select
          name={controlled ? undefined : opName}
          value={controlled ? op : undefined}
          defaultValue={controlled ? undefined : op}
          disabled={disabled}
          onChange={
            onOperatoreOpChange
              ? (e) => onOperatoreOpChange(parseOperatoreOp(e.target.value))
              : undefined
          }
          className="h-9 min-w-[2.75rem] shrink-0 rounded border-0 bg-transparent px-1 text-sm font-semibold disabled:opacity-60"
          aria-label="Operatore filtro codice operatore"
        >
          {OPERATORE_FILTER_OPS.map((o) => (
            <option key={o.value} value={o.value} title={o.title}>
              {o.label}
            </option>
          ))}
        </select>
        <span className="text-[var(--muted)]">|</span>
        <button
          type="button"
          disabled={!canSelect}
          onClick={() => canSelect && setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={listId}
          className="flex min-w-0 flex-1 items-center gap-1 px-1 text-left text-xs text-[var(--muted)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span className="min-w-0 flex-1 truncate">{riepilogo}</span>
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-[var(--navy)] transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>
        {!controlled ? <input type="hidden" name={fieldName} value={joined} /> : null}
      </div>

      {open && canSelect ? (
        <ul
          id={listId}
          className="absolute z-20 mt-1 max-h-40 w-full min-w-[14rem] overflow-y-auto rounded border border-[#7d94a8] bg-white shadow-lg"
          aria-label="Elenco operatori"
        >
          {operatori.map((o) => {
            const checked = selected.includes(o.id);
            const codice = codiceOperatoreFiltro(o);
            return (
              <li key={o.id} className="border-b border-[var(--line)] last:border-b-0">
                <label className="flex cursor-pointer items-center gap-2 px-2 py-1.5 text-sm hover:bg-[#f8fafc]">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => toggle(o.id, e.target.checked)}
                    className="h-3.5 w-3.5 shrink-0 rounded border-[#7d94a8] text-[var(--navy)]"
                  />
                  <span className="min-w-0 truncate leading-snug">
                    <span className="font-semibold">{codice}</span>
                    <span className="text-[var(--muted)]"> — {o.name}</span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
