"use client";

import type { ProvvigioniSortDir, ProvvigioniSortField } from "@/lib/provvigioniListaSort";

function SortButton({
  label,
  field,
  sortField,
  sortDir,
  onSort,
  align = "left",
}: {
  label: string;
  field: ProvvigioniSortField;
  sortField: ProvvigioniSortField;
  sortDir: ProvvigioniSortDir;
  onSort: (field: ProvvigioniSortField) => void;
  align?: "left" | "right";
}) {
  const active = sortField === field;
  return (
    <button
      type="button"
      onClick={() => onSort(field)}
      title="Ordina crescente / decrescente"
      className={`inline-flex max-w-full items-center gap-1 font-inherit hover:text-[var(--navy)] ${
        align === "right" ? "ml-auto" : ""
      } ${active ? "font-semibold text-[var(--navy)]" : ""}`}
    >
      <span>{label}</span>
      <span className="text-[11px] font-bold opacity-70" aria-hidden>
        {active ? (sortDir === "asc" ? "↑" : "↓") : "⇅"}
      </span>
    </button>
  );
}

export function ProvvigioniTabellaHead({
  sortField,
  sortDir,
  onSort,
  showOperatore = true,
  checkboxCol = false,
  actionsCol = false,
}: {
  sortField: ProvvigioniSortField;
  sortDir: ProvvigioniSortDir;
  onSort: (field: ProvvigioniSortField) => void;
  showOperatore?: boolean;
  checkboxCol?: boolean;
  actionsCol?: boolean;
}) {
  const th = "px-3 py-2 align-middle";
  const thRight = `${th} text-right`;
  return (
    <tr>
      {checkboxCol ? <th className="w-8 px-2 py-2" /> : null}
      <th className={th}>
        <SortButton
          label="Perimetro"
          field="perimetro"
          sortField={sortField}
          sortDir={sortDir}
          onSort={onSort}
        />
      </th>
      <th className={th}>
        <SortButton
          label="Data incasso"
          field="data"
          sortField={sortField}
          sortDir={sortDir}
          onSort={onSort}
        />
      </th>
      {showOperatore ? (
        <th className={th}>
          <SortButton
            label="Operatore"
            field="operatore"
            sortField={sortField}
            sortDir={sortDir}
            onSort={onSort}
          />
        </th>
      ) : null}
      <th className={th}>
        <SortButton
          label="Codice scarico"
          field="codiceScarico"
          sortField={sortField}
          sortDir={sortDir}
          onSort={onSort}
        />
      </th>
      <th className={th}>
        <SortButton label="Esito" field="modo" sortField={sortField} sortDir={sortDir} onSort={onSort} />
      </th>
      <th className={th}>
        <SortButton
          label="Fattura"
          field="fattura"
          sortField={sortField}
          sortDir={sortDir}
          onSort={onSort}
        />
      </th>
      <th className={th}>
        <SortButton
          label="Pratica"
          field="pratica"
          sortField={sortField}
          sortDir={sortDir}
          onSort={onSort}
        />
      </th>
      <th className={th}>
        <SortButton
          label="Debitore"
          field="debitore"
          sortField={sortField}
          sortDir={sortDir}
          onSort={onSort}
        />
      </th>
      <th className={thRight}>
        <SortButton
          label="Incasso"
          field="incasso"
          sortField={sortField}
          sortDir={sortDir}
          onSort={onSort}
          align="right"
        />
      </th>
      <th className={`${thRight} whitespace-nowrap`}>
        <SortButton
          label="% adottata"
          field="percentuale"
          sortField={sortField}
          sortDir={sortDir}
          onSort={onSort}
          align="right"
        />
      </th>
      <th className={thRight}>
        <SortButton
          label="Provvigione"
          field="provvigione"
          sortField={sortField}
          sortDir={sortDir}
          onSort={onSort}
          align="right"
        />
      </th>
      <th className={th}>
        <SortButton label="Stato" field="stato" sortField={sortField} sortDir={sortDir} onSort={onSort} />
      </th>
      {actionsCol ? <th className="w-16 px-2 py-2" /> : null}
    </tr>
  );
}
