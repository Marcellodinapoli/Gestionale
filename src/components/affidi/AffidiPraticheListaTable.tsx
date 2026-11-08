"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import {
  PRATICHE_LISTA_COLS,
  PraticheListaColgroup,
  praticheListaCell,
  praticheListaStickyClass,
  praticheListaTableMinWidth,
} from "@/components/pratiche/praticheListaCells";
import { CheckboxSelezione } from "@/components/affidi/affidoSelezione";
import type { PraticaListaRow } from "@/lib/praticheListaRow";
import type { AffidaSortCol } from "@/lib/affidi/affidiListaSort";

export function AffidiPraticheListaTable({
  righe,
  leading,
  trailing,
  selectionHeader,
  sortColumns,
  emptyMessage = "Nessuna pratica.",
}: {
  righe: PraticaListaRow[];
  leading?: (p: PraticaListaRow) => ReactNode;
  trailing?: (p: PraticaListaRow) => ReactNode;
  selectionHeader?: {
    inputRef: React.RefObject<HTMLInputElement | null>;
    checked: boolean;
    onChange: () => void;
    label: string;
  };
  sortColumns?: AffidaSortCol[];
  emptyMessage?: string;
}) {
  const sortByKey = new Map((sortColumns ?? []).map((c) => [c.key, c]));
  const extraLeading = leading || selectionHeader ? 1 : 0;
  const extraTrailing = trailing ? 1 : 0;
  const colSpan = PRATICHE_LISTA_COLS.length + extraLeading + extraTrailing;
  const tableMinWidth = praticheListaTableMinWidth(
    (extraLeading ? 48 : 0) + (extraTrailing ? 200 : 0)
  );

  return (
    <div className="flex min-h-[280px] max-h-[min(70vh,720px)] min-w-0 flex-col overflow-hidden rounded-xl border border-[var(--line)] bg-white">
      <div
        className="min-h-0 min-w-0 flex-1 overflow-x-scroll overflow-y-auto"
        style={{ scrollbarGutter: "stable" }}
      >
        <table
          className="min-w-max border-collapse text-sm"
          style={{ minWidth: `${tableMinWidth}px` }}
        >
          <PraticheListaColgroup hasLeadingCol={Boolean(extraLeading)} />
          <thead className="bg-[#e8eef4] text-left text-[var(--navy)]">
            <tr>
              {extraLeading ? (
                <th className="sticky left-0 z-[4] w-10 min-w-10 max-w-10 bg-[#e8eef4] px-3 py-2.5 align-middle">
                  {selectionHeader ? (
                    <CheckboxSelezione
                      inputRef={selectionHeader.inputRef}
                      checked={selectionHeader.checked}
                      onChange={selectionHeader.onChange}
                      label={selectionHeader.label}
                    />
                  ) : null}
                </th>
              ) : null}
              {PRATICHE_LISTA_COLS.map((col) => {
                const sort = sortByKey.get(col.sortKey);
                const sticky = praticheListaStickyClass(col.key, {
                  hasLeadingCol: Boolean(extraLeading),
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
              {trailing ? (
                <th className="whitespace-nowrap px-2 py-2.5 align-middle text-sm font-bold">
                  Operatore
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {righe.map((p) => (
              <tr key={p.id} className="border-t border-[var(--line)]">
                {extraLeading ? (
                  <td className="sticky left-0 z-[4] w-10 min-w-10 max-w-10 bg-white px-3 py-2 align-middle">
                    {leading ? leading(p) : null}
                  </td>
                ) : null}
                {PRATICHE_LISTA_COLS.map((col) => (
                  <td
                    key={col.key}
                    className={`px-2 py-2 text-xs whitespace-nowrap align-middle ${praticheListaStickyClass(col.key, {
                      hasLeadingCol: Boolean(extraLeading),
                      surface: "body",
                    })}`}
                  >
                    {praticheListaCell(p, col.key)}
                  </td>
                ))}
                {trailing ? (
                  <td className="px-2 py-2 align-middle whitespace-nowrap">{trailing(p)}</td>
                ) : null}
              </tr>
            ))}
            {!righe.length ? (
              <tr>
                <td colSpan={colSpan} className="px-3 py-8 text-center text-[var(--muted)]">
                  {emptyMessage}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AffidiListaCheckbox({
  checked,
  onChange,
  label,
  inputRef,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <CheckboxSelezione
      inputRef={inputRef}
      checked={checked}
      onChange={onChange}
      label={label}
    />
  );
}
