"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { CodiceScaricoPerimetro } from "@/lib/mandantePerimetri";
import {
  COD_SCARICO_FILTER_OPS,
  joinCodScaricoList,
  parseCodScaricoList,
  parseCodScaricoOp,
  type CodScaricoOp,
} from "@/lib/filtriCodScarico";
import { FILTRI_FIELD_CLASS } from "@/components/filtri/filtriFieldStyles";
import { hintCodiciScaricoFiltro } from "@/lib/filtriCodScaricoPerimetro";

export function CodScaricoFiltroControls({
  codScarico,
  codScaricoOp,
  onCodScaricoChange,
  onCodScaricoOpChange,
  opName = "codScaricoOp",
  codeName = "codScarico",
  fieldClass,
  codiciDisponibili = [],
  mandatoId,
}: {
  codScarico?: string;
  codScaricoOp?: CodScaricoOp | string;
  onCodScaricoChange?: (codes: string[]) => void;
  onCodScaricoOpChange?: (value: CodScaricoOp) => void;
  opName?: string;
  codeName?: string;
  fieldClass?: string;
  codiciDisponibili?: CodiceScaricoPerimetro[];
  mandatoId?: string | null;
}) {
  const op = parseCodScaricoOp(codScaricoOp);
  const controlled = Boolean(onCodScaricoChange);
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>(() => parseCodScaricoList(codScarico));

  useEffect(() => {
    setSelected(parseCodScaricoList(codScarico));
  }, [codScarico]);

  useEffect(() => {
    const allowed = new Set(codiciDisponibili.map((c) => c.codice.toUpperCase()));
    setSelected((prev) => {
      const filtered = prev.filter((c) => allowed.has(c.toUpperCase()));
      if (filtered.length !== prev.length) {
        onCodScaricoChange?.(filtered);
        return filtered;
      }
      return prev;
    });
  }, [codiciDisponibili, onCodScaricoChange]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const joined = joinCodScaricoList(selected);
  const canSelect = codiciDisponibili.length > 0;
  const hint = hintCodiciScaricoFiltro(canSelect);

  function applySelected(next: string[]) {
    setSelected(next);
    onCodScaricoChange?.(next);
  }

  function toggle(code: string, checked: boolean) {
    const set = new Set(selected);
    if (checked) set.add(code);
    else set.delete(code);
    applySelected([...set]);
  }

  const riepilogo = selected.length
    ? `${selected.length} codice${selected.length === 1 ? "" : "i"} selezionat${selected.length === 1 ? "o" : "i"}`
    : hint;

  return (
    <div ref={rootRef} className="relative min-w-0">
      <div
        className={`flex min-w-0 items-center gap-1 ${fieldClass ?? FILTRI_FIELD_CLASS}`}
        title="Codice scarico"
      >
        <select
          name={controlled ? undefined : opName}
          value={controlled ? op : undefined}
          defaultValue={controlled ? undefined : op}
          onChange={
            onCodScaricoOpChange
              ? (e) => onCodScaricoOpChange(parseCodScaricoOp(e.target.value))
              : undefined
          }
          className="h-9 min-w-[2.75rem] shrink-0 rounded border-0 bg-transparent px-1 text-sm font-semibold"
          aria-label="Operatore codice scarico"
        >
          {COD_SCARICO_FILTER_OPS.map((o) => (
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
        {!controlled ? <input type="hidden" name={codeName} value={joined} /> : null}
      </div>

      {open && canSelect ? (
        <ul
          id={listId}
          className="absolute z-20 mt-1 max-h-36 w-full overflow-y-auto rounded border border-[#7d94a8] bg-white shadow-lg"
          aria-label="Elenco codici scarico"
        >
          {codiciDisponibili.map((c) => {
            const code = c.codice.toUpperCase();
            const checked = selected.some((s) => s.toUpperCase() === code);
            return (
              <li key={code} className="border-b border-[var(--line)] last:border-b-0">
                <label className="flex cursor-pointer items-center gap-2 px-2 py-1.5 text-sm hover:bg-[#f8fafc]">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => toggle(code, e.target.checked)}
                    className="h-3.5 w-3.5 shrink-0 rounded border-[#7d94a8] text-[var(--navy)]"
                  />
                  <span className="min-w-0 truncate leading-snug">
                    <span className="font-semibold">{code}</span>
                    {c.descrizione ? (
                      <span className="text-[var(--muted)]"> — {c.descrizione}</span>
                    ) : null}
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
