"use client";

export function TipoAffidoSelect({
  name = "tipoAffido",
  showRipristina,
  onChange,
}: {
  name?: string;
  showRipristina?: boolean;
  onChange?: (value: string) => void;
}) {
  return (
    <select
      name={name}
      defaultValue="definitivo"
      onChange={onChange ? (e) => onChange(e.target.value) : undefined}
      className="h-9 min-w-[168px] rounded-lg border border-[var(--line)] px-2 text-sm"
    >
      <option value="definitivo">Affido definitivo</option>
      <option value="temporaneo">Affido temporaneo</option>
      {showRipristina ? <option value="ripristina">Ripristina titolare</option> : null}
    </select>
  );
}
