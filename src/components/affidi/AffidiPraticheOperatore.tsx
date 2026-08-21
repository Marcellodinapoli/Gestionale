"use client";

import Link from "next/link";
import type { PraticaAffido } from "@/components/affidi/AffidiCaricoOperatori";
import {
  AffidoMassivoForm,
  CheckboxSelezione,
  useSelezionePratiche,
} from "@/components/affidi/affidoSelezione";
import { etichettaTipoAffido, isAffidoTemporaneo } from "@/lib/affido";
import { isPraticaChiusa } from "@/lib/praticaCollegata";
import { codiceScaricoPratica } from "@/lib/scarico";
import { StatoBadge } from "@/components/ui";

function euro(value: number) {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
  }).format(value || 0);
}

export function AffidiPraticheOperatore({
  nome,
  pratiche,
  showAssegnatario,
  operatori,
}: {
  nome: string;
  pratiche: PraticaAffido[];
  showAssegnatario?: boolean;
  operatori: Array<{ id: string; name: string }>;
}) {
  const aperte = pratiche.filter((p) => !isPraticaChiusa(p.stato));
  const chiuse = pratiche.filter((p) => isPraticaChiusa(p.stato));
  const lista = [...aperte, ...chiuse];
  const { selected, allRef, allChecked, toggleAll, toggleOne } =
    useSelezionePratiche(lista.map((p) => p.id));
  const colSpan = showAssegnatario ? 9 : 8;

  return (
    <div>
      <p className="mb-2 text-xs text-[var(--muted)]">
        {nome}: {aperte.length} in coda
        {chiuse.length ? ` · ${chiuse.length} chiuse` : ""}
      </p>
      {lista.length ? (
        <AffidoMassivoForm
          selectedIds={[...selected]}
          operatori={operatori}
          emptyHint="Seleziona le pratiche da riaffidare"
          submitLabel="Riaffida selezionate"
          showRipristina={true}
        />
      ) : null}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="text-left text-[var(--muted)]">
            <tr>
              <th className="w-10 py-2 pr-2">
                {lista.length ? (
                  <CheckboxSelezione
                    inputRef={allRef}
                    checked={allChecked}
                    onChange={toggleAll}
                    label="Seleziona tutte"
                  />
                ) : null}
              </th>
              <th className="py-2">Pratica</th>
              {showAssegnatario ? <th>Operatore</th> : null}
              <th>Affido</th>
              <th>Debitore</th>
              <th>Mand.</th>
              <th>Coda</th>
              <th>Codice</th>
              <th className="text-right">Residuo</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((p) => (
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
                  </Link>
                </td>
                {showAssegnatario ? (
                  <td>{p.assegnatario?.name || "—"}</td>
                ) : null}
                <td>
                  <span
                    className={`rounded px-1.5 py-0.5 text-xs ${
                      isAffidoTemporaneo(p)
                        ? "bg-amber-100 text-amber-900"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {etichettaTipoAffido(p)}
                  </span>
                  {isAffidoTemporaneo(p) && p.operatoreTitolare ? (
                    <span className="ml-1 text-xs text-[var(--muted)]">
                      tit. {p.operatoreTitolare.name}
                    </span>
                  ) : null}
                </td>
                <td>
                  {p.debitore.cognome} {p.debitore.nome}
                </td>
                <td>{p.mandante.codice}</td>
                <td>
                  <StatoBadge stato={p.stato} />
                </td>
                <td className="font-mono text-xs">
                  {codiceScaricoPratica(p.stato, p.codiceScarico) || "—"}
                </td>
                <td className="text-right">{euro(p.residuo)}</td>
              </tr>
            ))}
            {!lista.length ? (
              <tr>
                <td colSpan={colSpan} className="py-6 text-center text-[var(--muted)]">
                  Nessuna pratica in questa coda.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
