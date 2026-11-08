import {
  FILTRI_APPLY_BUTTON_CLASS,
  FILTRI_PAGE_SELECT_LG_CLASS,
} from "@/components/filtri/filtriFieldStyles";

export function PredictiveGruppoPicker({
  basePath,
  supervisori,
  supervisorId,
  gruppoId,
  extraHidden,
}: {
  basePath: "/predictive/campagne" | "/predictive/monitor";
  supervisori: Array<{ id: string; name: string; gruppoNome: string | null }>;
  supervisorId: string;
  gruppoId?: string;
  extraHidden?: Record<string, string>;
}) {
  if (!supervisori.length) return null;

  return (
    <form className="mb-3 flex flex-wrap items-end gap-2" method="get" action={basePath}>
      {extraHidden
        ? Object.entries(extraHidden).map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))
        : null}
      <label className="text-sm">
        <span className="mb-1 block text-xs font-medium text-[var(--muted)]">Gruppo</span>
        <select
          name="gruppo"
          defaultValue={gruppoId || supervisorId}
          className={`min-w-[200px] ${FILTRI_PAGE_SELECT_LG_CLASS}`}
        >
          {supervisori.map((s) => (
            <option key={s.id} value={s.id}>
              {s.gruppoNome || s.name}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" className={`h-10 ${FILTRI_APPLY_BUTTON_CLASS}`}>
        Mostra
      </button>
    </form>
  );
}
