"use client";

import Link from "next/link";
import { AffidaForm } from "@/components/affidi/AffidaForm";
import { StatoBadge } from "@/components/ui";
import {
  AffidoMassivoForm,
  CheckboxSelezione,
  useSelezionePratiche,
} from "@/components/affidi/affidoSelezione";

function euro(value: number) {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
  }).format(value || 0);
}

export type PraticaDaAffidare = {
  id: string;
  numero: string;
  stato: string;
  residuo: number;
  debitoreNome: string;
};

export function AffidiDaAffidareTable({
  pratiche,
  operatori,
}: {
  pratiche: PraticaDaAffidare[];
  operatori: Array<{ id: string; name: string }>;
}) {
  const { selected, allRef, allChecked, toggleAll, toggleOne } =
    useSelezionePratiche(pratiche.map((p) => p.id));

  return (
    <div>
      <AffidoMassivoForm selectedIds={[...selected]} operatori={operatori} hideTipoAffido />

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="text-left text-[var(--muted)]">
            <tr>
              <th className="w-10 py-2 pr-2">
                <CheckboxSelezione
                  inputRef={allRef}
                  checked={allChecked}
                  onChange={toggleAll}
                  label="Seleziona tutte"
                />
              </th>
              <th className="py-2">Pratica</th>
              <th>Debitore</th>
              <th>Residuo</th>
              <th>Operatore</th>
            </tr>
          </thead>
          <tbody>
            {pratiche.map((p) => (
              <tr key={p.id} className="border-t border-[var(--line)]">
                <td className="py-2 pr-2">
                  <CheckboxSelezione
                    checked={selected.has(p.id)}
                    onChange={() => toggleOne(p.id)}
                    label={`Seleziona ${p.numero}`}
                  />
                </td>
                <td className="py-2">
                  <Link className="text-[var(--accent)] underline" href={`/pratiche/${p.id}`}>
                    {p.numero}
                  </Link>{" "}
                  <StatoBadge stato={p.stato} />
                </td>
                <td>{p.debitoreNome}</td>
                <td>{euro(p.residuo)}</td>
                <td>
                  <AffidaForm praticaId={p.id} operatori={operatori} hideTipoAffido />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
