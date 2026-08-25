"use client";

import Link from "next/link";
import { AffidaForm } from "@/components/affidi/AffidaForm";
import { StatoBadge } from "@/components/ui";
import {
  AffidoMassivoForm,
  CheckboxSelezione,
  buildPraticheStato,
  useSelezionePratiche,
} from "@/components/affidi/affidoSelezione";
import { etichettaTipoAffido, isAffidoTemporaneo } from "@/lib/affido";

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
  assegnatarioId?: string | null;
  assegnatarioNome?: string | null;
  operatoreTitolareId?: string | null;
  operatoreTitolareNome?: string | null;
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
  const praticheStato = buildPraticheStato(pratiche);

  return (
    <div>
      <AffidoMassivoForm
        selectedIds={[...selected]}
        praticheStato={praticheStato}
        operatori={operatori}
        emptyHint="Seleziona le pratiche da affidare o riaffidare"
        submitLabel="Affida selezionate"
        showRipristina
      />

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
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
              <th>Assegnatario</th>
              <th>Affido</th>
              <th>Residuo</th>
              <th>Operatore</th>
            </tr>
          </thead>
          <tbody>
            {pratiche.map((p) => {
              const temporaneo = isAffidoTemporaneo(p);
              return (
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
                <td>{p.assegnatarioNome || "—"}</td>
                <td>
                  <span
                    className={`rounded px-1.5 py-0.5 text-xs ${
                      temporaneo
                        ? "bg-amber-100 text-amber-900"
                        : p.assegnatarioId
                          ? "bg-slate-100 text-slate-700"
                          : "text-[var(--muted)]"
                    }`}
                  >
                    {etichettaTipoAffido(p)}
                  </span>
                  {temporaneo && p.operatoreTitolareNome ? (
                    <span className="ml-1 text-xs text-[var(--muted)]">
                      tit. {p.operatoreTitolareNome}
                    </span>
                  ) : null}
                </td>
                <td>{euro(p.residuo)}</td>
                <td>
                  <AffidaForm
                    praticaId={p.id}
                    operatori={operatori}
                    statoAffido={{
                      assegnatarioId: p.assegnatarioId ?? null,
                      operatoreTitolareId: p.operatoreTitolareId ?? null,
                    }}
                    titolareName={p.operatoreTitolareNome}
                    submitLabel={p.assegnatarioId ? "Riaffida" : "Affida"}
                  />
                </td>
              </tr>
            );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
