import {
  addOperatoreAlGruppoAction,
  removeOperatoreDalGruppoAction,
  updateGruppoNomeAction,
} from "@/actions/gruppoOperatori";

export type OperatoreAnagrafica = {
  id: string;
  name: string;
  supervisorId: string | null;
  supervisorName: string | null;
};

export function GruppoOperatoriCard({
  supervisorId,
  membri,
  tuttiOperatori,
  gruppoNome,
}: {
  supervisorId: string;
  membri: Array<{ id: string; name: string; role: string }>;
  tuttiOperatori: OperatoreAnagrafica[];
  gruppoNome?: string | null;
}) {
  const nelGruppo = new Set(
    membri.filter((m) => m.role === "OPERATOR").map((m) => m.id)
  );
  const operatoriGruppo = tuttiOperatori.filter((o) => nelGruppo.has(o.id));

  return (
    <div className="space-y-3">
      <form action={updateGruppoNomeAction} className="flex flex-wrap items-end gap-2">
        <label className="min-w-[240px] flex-1 text-sm">
          <span className="mb-1 block text-xs font-semibold text-[var(--muted)]">
            Nome del gruppo
          </span>
          <input
            name="gruppoNome"
            type="text"
            defaultValue={gruppoNome || ""}
            placeholder="es. Gruppo Milano, Team Alpha…"
            className="h-9 w-full rounded-lg border border-[var(--line)] px-2 text-sm"
          />
        </label>
        <button
          type="submit"
          className="h-9 rounded-lg bg-[var(--navy)] px-3 text-sm text-white"
        >
          Salva nome
        </button>
      </form>

      <form action={addOperatoreAlGruppoAction} className="flex flex-wrap items-end gap-2">
        <label className="min-w-[240px] flex-1 text-sm">
          <span className="mb-1 block text-xs font-semibold text-[var(--muted)]">
            Operatori
          </span>
          <select
            name="operatoreId"
            required
            className="h-9 w-full rounded-lg border border-[var(--line)] px-2 text-sm"
          >
            <option value="">Tutti gli operatori…</option>
            {tuttiOperatori.map((o) => {
              const inQuesto = o.supervisorId === supervisorId;
              const altro = o.supervisorName && !inQuesto ? ` · ${o.supervisorName}` : "";
              return (
                <option key={o.id} value={o.id}>
                  {o.name}
                  {inQuesto ? " (nel gruppo)" : altro}
                </option>
              );
            })}
          </select>
        </label>
        <button
          type="submit"
          className="h-9 rounded-lg bg-[var(--navy)] px-3 text-sm text-white"
        >
          Aggiungi al gruppo
        </button>
      </form>

      {operatoriGruppo.length ? (
        <ul className="flex flex-wrap gap-2">
          {operatoriGruppo.map((o) => (
            <li
              key={o.id}
              className="flex items-center gap-2 rounded-full border border-[var(--line)] bg-[#eef4f8] px-3 py-1 text-sm"
            >
              {o.name}
              <form action={removeOperatoreDalGruppoAction}>
                <input type="hidden" name="operatoreId" value={o.id} />
                <button
                  type="submit"
                  className="text-xs text-[var(--muted)] underline"
                  title={`Rimuovi ${o.name} dal gruppo`}
                >
                  Rimuovi
                </button>
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-[var(--muted)]">
          Nessun operatore nel gruppo. Apri la tendina e scegli un nominativo.
        </p>
      )}
    </div>
  );
}
