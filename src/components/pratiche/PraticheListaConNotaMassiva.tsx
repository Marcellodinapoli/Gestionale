"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addAttivitaMassivaAction } from "@/actions/core";
import {
  CheckboxSelezione,
  useSelezionePratiche,
} from "@/components/affidi/affidoSelezione";
import { useReportPraticheSelezione } from "@/components/pratiche/PraticheConteggi";
import type { PraticaListaRow } from "@/lib/praticheListaRow";
import {
  PRATICHE_LISTA_COLS,
  PraticheListaColgroup,
  praticheListaCell,
  praticheListaStickyClass,
  praticheListaTableMinWidth,
} from "@/components/pratiche/praticheListaCells";

export type { PraticaListaRow };

type SortCol = {
  key: string;
  label: string;
  href: string;
  active: boolean;
  arrow: string;
};

const LIST_COLS = PRATICHE_LISTA_COLS;
type ColKey = (typeof LIST_COLS)[number]["key"];

export function PraticheListaConNotaMassiva({
  pratiche,
  sortColumns,
  canNotaMassiva,
  /** Tutti gli id del filtro corrente (tutte le pagine). Se assente = solo pagina. */
  tutteIds,
  /** Totale pratiche del filtro (per etichetta «N visibili»). */
  totaleFiltro,
  filtriAttivi,
}: {
  pratiche: PraticaListaRow[];
  sortColumns: SortCol[];
  canNotaMassiva: boolean;
  tutteIds?: string[];
  totaleFiltro?: number;
  /** Riepilogo filtri applicati (visibile a tutti). */
  filtriAttivi?: ReactNode;
}) {
  const router = useRouter();
  const pageIds = pratiche.map((p) => p.id);
  const scopeIds = tutteIds?.length ? tutteIds : pageIds;
  const { selected, allRef, allChecked, toggleAll, toggleOne, scopeTotal } =
    useSelezionePratiche(pageIds, { scopeIds });
  const [nota, setNota] = useState("");
  const [importante, setImportante] = useState(false);
  const [fissa, setFissa] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const selectedIds = [...selected];
  const colSpan = LIST_COLS.length + (canNotaMassiva ? 1 : 0);
  const sortByKey = new Map(sortColumns.map((c) => [c.key, c]));
  useReportPraticheSelezione(selectedIds.length, scopeTotal);

  function inviaNotaMassiva() {
    const testo = nota.trim();
    if (!selectedIds.length || !testo) return;
    setMsg(null);
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("nota", testo);
        if (importante) fd.set("importante", "1");
        if (fissa) fd.set("fissa", "1");
        for (const id of selectedIds) fd.append("praticaId", id);
        const result = await addAttivitaMassivaAction(fd);
        setNota("");
        setImportante(false);
        setFissa(false);
        const flags = [
          result.importante ? "importante" : null,
          result.fissata ? "fissa" : null,
        ]
          .filter(Boolean)
          .join(", ");
        setMsg(
          result.saltate
            ? `Nota scritta su ${result.scritte} pratiche (${result.saltate} saltate: non accessibili o in uso)${
                flags ? ` · ${flags}` : ""
              }`
            : `Nota scritta su ${result.scritte} pratiche${flags ? ` · ${flags}` : ""}`
        );
        router.refresh();
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "Errore");
      }
    });
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-3">
      {canNotaMassiva ? (
        <div
          className={`rounded-xl border p-3 transition-colors ${
            importante
              ? "border-amber-400 bg-[#ffe08a]"
              : fissa
                ? "border-sky-300 bg-sky-50"
                : "border-[var(--line)] bg-white"
          }`}
        >
          <div className="flex flex-wrap items-end gap-2">
            <label className="min-w-[220px] flex-1 text-sm">
              <span
                className={`mb-1 block text-[10px] font-semibold uppercase ${
                  importante ? "text-[#5a3e00]" : "text-[var(--muted)]"
                }`}
              >
                Nota massiva
                {importante && fissa
                  ? " · importante + fissa"
                  : importante
                    ? " · messaggio importante"
                    : fissa
                      ? " · fissa"
                      : ""}
              </span>
              <textarea
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                rows={2}
                placeholder="Testo della nota da scrivere su tutte le pratiche selezionate…"
                className={`w-full rounded-lg border px-2 py-1.5 text-sm ${
                  importante
                    ? "border-amber-500 bg-white text-[#5a3e00]"
                    : "border-[var(--line)] bg-white"
                }`}
                disabled={pending}
              />
            </label>
            <div className="flex shrink-0 flex-col gap-1.5 pb-0.5 text-xs">
              <label className="inline-flex cursor-pointer items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={importante}
                  disabled={pending}
                  onChange={(e) => setImportante(e.target.checked)}
                  className="h-3.5 w-3.5 accent-amber-600"
                />
                <span
                  className={`font-semibold ${
                    importante ? "text-[#5a3e00]" : "text-[var(--navy)]"
                  }`}
                >
                  Messaggio importante
                </span>
              </label>
              <label className="inline-flex cursor-pointer items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={fissa}
                  disabled={pending}
                  onChange={(e) => setFissa(e.target.checked)}
                  className="h-3.5 w-3.5 accent-[var(--navy)]"
                />
                <span className="font-semibold text-[var(--navy)]">Fissa</span>
              </label>
            </div>
            <button
              type="button"
              onClick={inviaNotaMassiva}
              disabled={pending || !selectedIds.length || !nota.trim()}
              className={`h-9 shrink-0 rounded-lg px-4 text-sm font-semibold text-white disabled:opacity-50 hover:opacity-90 ${
                importante ? "bg-amber-700" : "bg-[var(--navy)]"
              }`}
            >
              {pending
                ? "Scrittura…"
                : selectedIds.length
                  ? `Scrivi su ${selectedIds.length} pratiche`
                  : "Seleziona pratiche"}
            </button>
          </div>
          <p
            className={`mt-1.5 text-[11px] ${
              importante ? "text-[#5a3e00]/80" : "text-[var(--muted)]"
            }`}
          >
            La spunta in intestazione seleziona <strong>tutte</strong> le pratiche del filtro
            (anche le altre pagine).
          </p>
          {msg ? (
            <p
              className={`mt-1.5 text-xs font-semibold ${
                msg.startsWith("Nota scritta") ? "text-emerald-700" : "text-amber-800"
              }`}
            >
              {msg}
            </p>
          ) : null}
        </div>
      ) : null}

      {filtriAttivi ? <div className="shrink-0 px-0.5">{filtriAttivi}</div> : null}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-[var(--line)] bg-white">
        <div
          className="min-h-0 flex-1 overflow-x-scroll overflow-y-auto"
          style={{ scrollbarGutter: "stable" }}
        >
          <table
            className="min-w-max border-collapse text-sm"
            style={{
              minWidth: `${praticheListaTableMinWidth(canNotaMassiva ? 120 : 0)}px`,
            }}
          >
            <PraticheListaColgroup hasLeadingCol={canNotaMassiva} />
            <thead className="bg-[#e8eef4] text-left text-[var(--navy)]">
              <tr>
                {canNotaMassiva ? (
                  <th className="sticky left-0 z-[4] w-10 min-w-10 max-w-10 bg-[#e8eef4] px-3 py-2.5 align-middle">
                    <CheckboxSelezione
                      inputRef={allRef}
                      checked={allChecked}
                      onChange={toggleAll}
                      label={`Seleziona tutte (${scopeTotal})`}
                    />
                  </th>
                ) : null}
                {LIST_COLS.map((col) => {
                  const sort = sortByKey.get(col.sortKey);
                  const sticky = praticheListaStickyClass(col.key, {
                    hasLeadingCol: canNotaMassiva,
                    surface: "header",
                  });
                  return (
                    <th
                      key={col.key}
                      className={`whitespace-nowrap px-2 py-2.5 align-middle ${sticky}`}
                    >
                      {sort ? (
                        <Link
                          href={sort.href}
                          className={`inline-flex items-center gap-1 text-sm font-bold hover:text-[var(--accent)] ${
                            sort.active ? "text-[var(--accent)]" : ""
                          }`}
                          title="Ordina crescente / decrescente"
                        >
                          {col.label}
                          <span className="text-xs font-bold opacity-70">
                            {sort.arrow?.trim() || "⇅"}
                          </span>
                        </Link>
                      ) : (
                        <span className="text-sm font-bold">{col.label}</span>
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
                {pratiche.map((p) => {
                  const isSelected = canNotaMassiva && selected.has(p.id);
                  return (
                  <tr
                    key={p.id}
                    className={`border-t border-[var(--line)] ${
                      isSelected ? "bg-[#eef4f8]/60" : ""
                    }`}
                  >
                    {canNotaMassiva ? (
                      <td
                        className={`sticky left-0 z-[4] w-10 min-w-10 max-w-10 px-3 py-2 ${
                          isSelected ? "bg-[#eef4f8]" : "bg-white"
                        }`}
                      >
                        <CheckboxSelezione
                          checked={selected.has(p.id)}
                          onChange={() => toggleOne(p.id)}
                          label={`Seleziona ${p.numero}`}
                        />
                      </td>
                    ) : null}
                    {LIST_COLS.map((col) => {
                      const sticky = praticheListaStickyClass(col.key, {
                        hasLeadingCol: canNotaMassiva,
                        surface: "body",
                        rowSelected: isSelected,
                      });
                      return (
                        <td
                          key={col.key}
                          className={`px-2 py-2 text-xs whitespace-nowrap ${sticky}`}
                        >
                          {praticheListaCell(p, col.key)}
                        </td>
                      );
                    })}
                  </tr>
                  );
                })}
                {!pratiche.length ? (
                  <tr>
                    <td
                      colSpan={colSpan}
                      className="px-3 py-8 text-center text-[var(--muted)]"
                    >
                      Nessuna pratica trovata con i filtri selezionati.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
        </div>
      </div>
    </div>
  );
}
