import { addIncassoAction } from "@/actions/core";
import { METODI_INCASSO } from "@/lib/metodoIncasso";

export function IncassoForm({
  praticaId,
  compact,
}: {
  praticaId: string;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <form
        action={addIncassoAction}
        className="flex shrink-0 flex-wrap items-end gap-1.5 border-t border-[var(--line)] bg-[#eef2f6] px-2 py-1.5"
      >
        <input type="hidden" name="praticaId" value={praticaId} />
        <span className="mb-1 mr-1 text-[10px] font-semibold uppercase tracking-wide text-[#1a365d]">
          Inserisci incasso
        </span>
        <label className="text-[10px] text-[var(--muted)]">
          Importo
          <input
            name="importo"
            type="number"
            step="0.01"
            min="0.01"
            required
            placeholder="0,00"
            className="mt-0.5 block h-8 w-24 rounded border border-[var(--line)] bg-white px-2 text-sm"
          />
        </label>
        <label className="text-[10px] text-[var(--muted)]">
          Metodo
          <select
            name="metodo"
            className="mt-0.5 block h-8 rounded border border-[var(--line)] bg-white px-2 text-sm"
          >
            {METODI_INCASSO.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[10px] text-[var(--muted)]">
          Data
          <input
            type="date"
            name="data"
            className="mt-0.5 block h-8 rounded border border-[var(--line)] bg-white px-2 text-sm"
          />
        </label>
        <label className="min-w-[10rem] flex-1 text-[10px] text-[var(--muted)]">
          Causale
          <input
            name="causale"
            placeholder="Causale"
            className="mt-0.5 block h-8 w-full rounded border border-[var(--line)] bg-white px-2 text-sm"
          />
        </label>
        <button className="h-8 rounded bg-[var(--navy)] px-3 text-xs font-semibold text-white">
          Registra
        </button>
      </form>
    );
  }

  return (
    <form
      action={addIncassoAction}
      className="mt-4 grid gap-2 border-t border-[var(--line)] pt-3 sm:grid-cols-6"
    >
      <input type="hidden" name="praticaId" value={praticaId} />
      <input
        name="importo"
        type="number"
        step="0.01"
        required
        placeholder="Importo"
        className="h-9 rounded border border-[var(--line)] px-2 text-sm"
      />
      <select name="metodo" className="h-9 rounded border border-[var(--line)] px-2 text-sm">
        {METODI_INCASSO.map((m) => (
          <option key={m.value} value={m.value}>
            {m.label}
          </option>
        ))}
      </select>
      <input
        name="modo"
        defaultValue="VE"
        placeholder="Mo"
        className="h-9 rounded border border-[var(--line)] px-2 text-sm"
      />
      <input type="date" name="data" className="h-9 rounded border border-[var(--line)] px-2 text-sm" />
      <input
        type="date"
        name="dataScadenza"
        className="h-9 rounded border border-[var(--line)] px-2 text-sm"
      />
      <input
        name="causale"
        placeholder="Causale (es. da file:P17294…)"
        className="h-9 rounded border border-[var(--line)] px-2 text-sm sm:col-span-5"
      />
      <button className="h-9 rounded bg-[#132033] px-3 text-sm text-white">
        Registra incasso
      </button>
    </form>
  );
}
