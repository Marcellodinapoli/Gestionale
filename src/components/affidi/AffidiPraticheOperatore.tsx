"use client";

import { useMemo } from "react";
import type { PraticaListaRow } from "@/lib/praticheListaRow";
import { sortPraticaListaRows } from "@/lib/praticheListaRowSort";
import {
  affidaSortColumns,
  parseAffidaSortFromQuery,
} from "@/lib/affidi/affidiListaSort";
import {
  AffidoMassivoForm,
  buildPraticheStato,
  useSelezionePratiche,
} from "@/components/affidi/affidoSelezione";
import { isPraticaChiusa } from "@/lib/praticaCollegata";
import {
  AffidiListaCheckbox,
  AffidiPraticheListaTable,
} from "@/components/affidi/AffidiPraticheListaTable";

export function AffidiPraticheOperatore({
  nome,
  righe,
  operatori,
  praticheStatoInput,
  affidaQuery = "",
}: {
  nome: string;
  righe: PraticaListaRow[];
  operatori: Array<{ id: string; name: string }>;
  praticheStatoInput: Array<{
    id: string;
    assegnatarioId: string | null;
    operatoreTitolareId: string | null;
    stato: string;
  }>;
  affidaQuery?: string;
}) {
  const sortParsed = useMemo(() => parseAffidaSortFromQuery(affidaQuery), [affidaQuery]);
  const sortColumns = useMemo(
    () => affidaSortColumns(affidaQuery, sortParsed),
    [affidaQuery, sortParsed]
  );

  const lista = useMemo(() => {
    if (sortParsed) {
      return sortPraticaListaRows(righe, sortParsed.sort, sortParsed.dir);
    }
    const aperte = righe.filter((p) => {
      const raw = praticheStatoInput.find((x) => x.id === p.id);
      return raw ? !isPraticaChiusa(raw.stato) : true;
    });
    const chiuse = righe.filter((p) => {
      const raw = praticheStatoInput.find((x) => x.id === p.id);
      return raw ? isPraticaChiusa(raw.stato) : false;
    });
    return [...aperte, ...chiuse];
  }, [righe, praticheStatoInput, sortParsed]);

  const aperteCount = useMemo(() => {
    return righe.filter((p) => {
      const raw = praticheStatoInput.find((x) => x.id === p.id);
      return raw ? !isPraticaChiusa(raw.stato) : true;
    }).length;
  }, [righe, praticheStatoInput]);
  const chiuseCount = righe.length - aperteCount;
  const { selected, allRef, allChecked, toggleAll, toggleOne } =
    useSelezionePratiche(lista.map((p) => p.id));
  const praticheStato = buildPraticheStato(praticheStatoInput);

  return (
    <div>
      <p className="mb-2 text-xs text-[var(--muted)]">
        {nome}: {aperteCount} in coda
        {chiuseCount ? ` · ${chiuseCount} chiuse` : ""}
      </p>
      {lista.length ? (
        <AffidoMassivoForm
          selectedIds={[...selected]}
          praticheStato={praticheStato}
          operatori={operatori}
          emptyHint="Seleziona le pratiche da riaffidare"
          submitLabel="Riaffida selezionate"
          showRipristina={true}
        />
      ) : null}
      <AffidiPraticheListaTable
        righe={lista}
        sortColumns={sortColumns}
        selectionHeader={
          lista.length
            ? {
                inputRef: allRef,
                checked: allChecked,
                onChange: toggleAll,
                label: "Seleziona tutte",
              }
            : undefined
        }
        leading={(p) => (
          <AffidiListaCheckbox
            checked={selected.has(p.id)}
            onChange={() => toggleOne(p.id)}
            label={`Seleziona ${p.numero}`}
          />
        )}
        emptyMessage="Nessuna pratica in questa coda."
      />
    </div>
  );
}
