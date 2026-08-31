import { addIncassoAction } from "@/actions/core";
import { METODI_INCASSO } from "@/lib/metodoIncasso";

export function IncassoForm({ praticaId }: { praticaId: string }) {
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
