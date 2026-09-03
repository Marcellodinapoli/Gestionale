import {
  TEXT_FILTER_OPS,
  parseTextFilterOp,
  type TextFilterOp,
} from "@/lib/filtriTestoOp";
import { FILTRI_FIELD_CLASS } from "@/components/filtri/filtriFieldStyles";

const inputCls =
  "h-full min-w-0 flex-1 border-0 bg-transparent px-2 text-sm text-[var(--navy)] placeholder:text-[var(--muted)]";

export function TextFiltroControls({
  value = "",
  op,
  onValueChange,
  onOpChange,
  name,
  opName,
  placeholder,
  fieldClass,
  inputType = "text",
}: {
  value?: string;
  op?: TextFilterOp | string;
  onValueChange?: (value: string) => void;
  onOpChange?: (value: TextFilterOp) => void;
  name?: string;
  opName?: string;
  placeholder?: string;
  fieldClass?: string;
  inputType?: "text" | "search" | "tel";
}) {
  const parsedOp = parseTextFilterOp(op);
  const controlled = Boolean(onValueChange || onOpChange);

  return (
    <div
      className={`flex min-w-0 items-center gap-1 ${fieldClass ?? FILTRI_FIELD_CLASS}`}
    >
      <select
        name={controlled ? undefined : opName}
        value={controlled ? parsedOp : undefined}
        defaultValue={controlled ? undefined : parsedOp}
        onChange={
          onOpChange
            ? (e) => onOpChange(parseTextFilterOp(e.target.value))
            : undefined
        }
        className="h-9 min-w-[2.75rem] shrink-0 rounded border-0 bg-transparent px-1 text-sm font-semibold"
        aria-label="Operatore filtro testo"
      >
        {TEXT_FILTER_OPS.map((o) => (
          <option key={o.value} value={o.value} title={o.title}>
            {o.label}
          </option>
        ))}
      </select>
      <span className="text-[var(--muted)]">|</span>
      <input
        type={inputType}
        name={controlled ? undefined : name}
        value={controlled ? value : undefined}
        defaultValue={controlled ? undefined : value}
        onChange={onValueChange ? (e) => onValueChange(e.target.value) : undefined}
        placeholder={placeholder}
        className={inputCls}
      />
    </div>
  );
}
