"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AffidaForm } from "@/components/affidi/AffidaForm";
import { StatoBadge } from "@/components/ui";
import {
  AffidoMassivoForm,
  CheckboxSelezione,
  buildPraticheStato,
  useSelezionePratiche,
} from "@/components/affidi/affidoSelezione";
import { etichettaTipoAffido, isAffidoTemporaneo, sortKeyTipoAffido } from "@/lib/affido";

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

type SortCol = "numero" | "debitore" | "assegnatario" | "affido" | "residuo";
type SortDir = "asc" | "desc";

const SORT_COLS: { key: SortCol; label: string }[] = [
  { key: "numero", label: "Pratica" },
  { key: "debitore", label: "Debitore" },
  { key: "assegnatario", label: "Assegnatario" },
  { key: "affido", label: "Affido" },
  { key: "residuo", label: "Residuo" },
];

function comparePratiche(a: PraticaDaAffidare, b: PraticaDaAffidare, col: SortCol): number {
  switch (col) {
    case "numero":
      return a.numero.localeCompare(b.numero, "it", { numeric: true });
    case "debitore":
      return a.debitoreNome.localeCompare(b.debitoreNome, "it", { sensitivity: "base" });
    case "assegnatario":
      return (a.assegnatarioNome || "").localeCompare(b.assegnatarioNome || "", "it", {
        sensitivity: "base",
      });
    case "affido": {
      const cmp = sortKeyTipoAffido(a) - sortKeyTipoAffido(b);
      if (cmp !== 0) return cmp;
      return etichettaTipoAffido(a).localeCompare(etichettaTipoAffido(b), "it");
    }
    case "residuo":
      return a.residuo - b.residuo;
    default:
      return 0;
  }
}

function SortHeader({
  label,
  active,
  dir,
  onClick,
  className,
}: {
  label: string;
  active: boolean;
  dir: SortDir | null;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 font-bold hover:text-[var(--accent)] ${
        active ? "text-[var(--accent)]" : ""
      } ${className || ""}`}
      title="Ordina crescente / decrescente"
    >
      {label}
      <span className="text-xs font-bold opacity-70">
        {active && dir === "asc" ? "↑" : active && dir === "desc" ? "↓" : "⇅"}
      </span>
    </button>
  );
}

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
  const [sort, setSort] = useState<{ col: SortCol; dir: SortDir } | null>(null);

  const praticheOrdinate = useMemo(() => {
    if (!sort) return pratiche;
    const sign = sort.dir === "asc" ? 1 : -1;
    return [...pratiche].sort((a, b) => {
      const cmp = comparePratiche(a, b, sort.col);
      if (cmp !== 0) return cmp * sign;
      return a.numero.localeCompare(b.numero, "it", { numeric: true });
    });
  }, [pratiche, sort]);

  function toggleSort(col: SortCol) {
    setSort((prev) => {
      if (prev?.col === col) {
        return { col, dir: prev.dir === "asc" ? "desc" : "asc" };
      }
      return { col, dir: "asc" };
    });
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
              {SORT_COLS.map((col) => (
                <th key={col.key} className={col.key === "numero" ? "py-2" : undefined}>
                  <SortHeader
                    label={col.label}
                    active={sort?.col === col.key}
                    dir={sort?.col === col.key ? sort.dir : null}
                    onClick={() => toggleSort(col.key)}
                  />
                </th>
              ))}
              <th className="font-bold">Operatore</th>
            </tr>
          </thead>
          <tbody>
            {praticheOrdinate.map((p) => {
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
