import type { ReactNode } from "react";
import {
  TEXT_FILTER_OPS,
  parseTextFilterOp,
  type TextFilterOp,
} from "@/lib/filtriTestoOp";
import { FILTRI_FIELD_CLASS } from "@/components/filtri/filtriFieldStyles";

const valueSelectCls =
  "h-9 min-w-0 w-full flex-1 rounded border-0 bg-transparent px-1 text-sm text-[var(--navy)]";

export function SelectFiltroControls({
  op,
  onOpChange,
  opName,
  name,
  value,
  defaultValue,
  onValueChange,
  fieldClass,
  ariaLabel,
  children,
}: {
  op?: TextFilterOp | string;
  onOpChange?: (value: TextFilterOp) => void;
  opName?: string;
  name?: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  fieldClass?: string;
  ariaLabel?: string;
  children: ReactNode;
}) {
  const parsedOp = parseTextFilterOp(op);
  const opControlled = onOpChange !== undefined;
  const valueSelectControlled = onValueChange !== undefined;

  return (
    <div
      className={`flex min-w-0 items-center gap-1 ${fieldClass ?? FILTRI_FIELD_CLASS}`}
    >
      <select
        name={opName}
        value={opControlled ? parsedOp : undefined}
        defaultValue={opControlled ? undefined : parsedOp}
        onChange={
          onOpChange
            ? (e) => onOpChange(parseTextFilterOp(e.target.value))
            : undefined
        }
        className="h-9 min-w-[2.75rem] shrink-0 rounded border-0 bg-transparent px-1 text-sm font-semibold"
        aria-label={ariaLabel ? `Operatore ${ariaLabel}` : "Operatore filtro"}
      >
        {TEXT_FILTER_OPS.map((o) => (
          <option key={o.value} value={o.value} title={o.title}>
            {o.label}
          </option>
        ))}
      </select>
      <span className="text-[var(--muted)]">|</span>
      <select
        name={name}
        value={valueSelectControlled ? (value ?? "") : undefined}
        defaultValue={
          valueSelectControlled ? undefined : (defaultValue ?? value ?? "")
        }
        onChange={onValueChange ? (e) => onValueChange(e.target.value) : undefined}
        className={valueSelectCls}
        aria-label={ariaLabel}
      >
        {children}
      </select>
    </div>
  );
}
