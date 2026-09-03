import type { AltriFiltri } from "@/lib/praticheAltriFiltriUi";
import { vociAltriFiltriAttivi } from "@/lib/praticheAltriFiltriUi";

export function AltriFiltriAttiviElenco({
  filtri,
  operatori,
  mandanti,
  excludeIds,
}: {
  filtri?: AltriFiltri;
  operatori?: Array<{ id: string; name: string }>;
  mandanti?: Array<{ id: string; codice: string; ragioneSociale: string }>;
  excludeIds?: string[];
}) {
  const skip = new Set(excludeIds ?? []);
  const voci = vociAltriFiltriAttivi(filtri, { operatori, mandanti }).filter(
    (v) => !skip.has(v.id)
  );
  if (!voci.length) return null;

  return (
    <ul className="mb-2 list-none space-y-1 text-xs text-[var(--muted)]">
      {voci.map((v) => (
        <li key={v.id}>
          Filtro attivo: {v.campo}
          {v.op ? ` ${v.op}` : ""}{" "}
          <span className="font-semibold text-[var(--navy)]">{v.valore}</span>
          {v.suffisso ? ` — ${v.suffisso}` : ""}.
        </li>
      ))}
    </ul>
  );
}
