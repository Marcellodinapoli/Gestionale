"use client";

import { useMemo } from "react";
import { AffidaForm } from "@/components/affidi/AffidaForm";
import {
  AffidoMassivoForm,
  buildPraticheStato,
  useSelezionePratiche,
} from "@/components/affidi/affidoSelezione";
import { PRATICHE_BACK_KEY } from "@/lib/praticheNavBack";
import { PaginazioneBar } from "@/components/PaginazioneBar";
import {
  AffidiListaCheckbox,
  AffidiPraticheListaTable,
} from "@/components/affidi/AffidiPraticheListaTable";
import type { PraticaListaRow } from "@/lib/praticheListaRow";
import { sortPraticaListaRows } from "@/lib/praticheListaRowSort";
import {
  affidaSortColumns,
  parseAffidaSortFromQuery,
} from "@/lib/affidi/affidiListaSort";

const AFFIDA_PAGE_SIZE = 50;

export type AffidiRigaLista = {
  lista: PraticaListaRow;
  assegnatarioId: string | null;
  operatoreTitolareId: string | null;
  operatoreTitolareNome?: string | null;
};

export function AffidiDaAffidareTable({
  righe,
  operatori,
  affidaPage: affidaPageProp,
  /** Query string Affidi (senza `?`) dal server: evita mismatch hydration con useSearchParams. */
  affidaQuery = "",
}: {
  righe: AffidiRigaLista[];
  operatori: Array<{ id: string; name: string }>;
  affidaPage?: string | null;
  affidaQuery?: string;
}) {

  const sortParsed = useMemo(() => parseAffidaSortFromQuery(affidaQuery), [affidaQuery]);
  const sortColumns = useMemo(
    () => affidaSortColumns(affidaQuery, sortParsed),
    [affidaQuery, sortParsed]
  );

  const liste = useMemo(() => {
    const base = righe.map((r) => r.lista);
    if (sortParsed) {
      return sortPraticaListaRows(base, sortParsed.sort, sortParsed.dir);
    }
    return [...base].sort((a, b) => {
      const ra = righe.find((r) => r.lista.id === a.id);
      const rb = righe.find((r) => r.lista.id === b.id);
      const aNuova = ra?.assegnatarioId ? 1 : 0;
      const bNuova = rb?.assegnatarioId ? 1 : 0;
      if (aNuova !== bNuova) return aNuova - bNuova;
      return a.numero.localeCompare(b.numero, "it");
    });
  }, [righe, sortParsed]);
  const byId = useMemo(() => new Map(righe.map((r) => [r.lista.id, r])), [righe]);

  const totalPages = Math.max(1, Math.ceil(liste.length / AFFIDA_PAGE_SIZE));
  const pageRaw = Number(affidaPageProp || "1");
  const page = Math.min(totalPages, Math.max(1, Number.isFinite(pageRaw) ? pageRaw : 1));
  const pageRows = useMemo(() => {
    const start = (page - 1) * AFFIDA_PAGE_SIZE;
    return liste.slice(start, start + AFFIDA_PAGE_SIZE);
  }, [liste, page]);

  const { selected, allRef, allChecked, toggleAll, toggleOne } = useSelezionePratiche(
    pageRows.map((p) => p.id)
  );
  const praticheStato = buildPraticheStato(
    righe.map((r) => ({
      id: r.lista.id,
      assegnatarioId: r.assegnatarioId,
      operatoreTitolareId: r.operatoreTitolareId,
    }))
  );

  function hrefWithParams(patch: Record<string, string | null>) {
    const sp = new URLSearchParams(affidaQuery);
    for (const [k, v] of Object.entries(patch)) {
      if (v == null || v === "") sp.delete(k);
      else sp.set(k, v);
    }
    const qs = sp.toString();
    return qs ? `/affidi?${qs}` : "/affidi";
  }

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

      {liste.length > AFFIDA_PAGE_SIZE ? (
        <p className="mb-2 text-xs text-[var(--muted)]">
          Pagina {page}/{totalPages} · {pageRows.length} di {liste.length} pratiche (max{" "}
          {AFFIDA_PAGE_SIZE}/pagina)
        </p>
      ) : null}

      <AffidiPraticheListaTable
        righe={pageRows}
        sortColumns={sortColumns}
        selectionHeader={
          pageRows.length
            ? {
                inputRef: allRef,
                checked: allChecked,
                onChange: toggleAll,
                label: "Seleziona tutte in pagina",
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
        trailing={(p) => {
          const meta = byId.get(p.id);
          if (!meta) return null;
          return (
            <AffidaForm
              praticaId={p.id}
              operatori={operatori}
              statoAffido={{
                assegnatarioId: meta.assegnatarioId,
                operatoreTitolareId: meta.operatoreTitolareId,
              }}
              titolareName={meta.operatoreTitolareNome}
              submitLabel={meta.assegnatarioId ? "Riaffida" : "Affida"}
            />
          );
        }}
      />

      {totalPages > 1 ? (
        <div className="mt-3">
          <PaginazioneBar
            page={page}
            totalPages={totalPages}
            hrefForPage={(p) => hrefWithParams({ affidaPage: String(p) })}
            onPageLinkClick={(url) => {
              try {
                sessionStorage.setItem(PRATICHE_BACK_KEY, url);
              } catch {
                /* ignore */
              }
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
