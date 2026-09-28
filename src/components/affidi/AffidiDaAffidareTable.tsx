"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AffidaForm } from "@/components/affidi/AffidaForm";
import { StatoBadge } from "@/components/ui";
import {
  AffidoMassivoForm,
  CheckboxSelezione,
  buildPraticheStato,
  useSelezionePratiche,
} from "@/components/affidi/affidoSelezione";
import { etichettaTipoAffido, isAffidoTemporaneo, sortKeyTipoAffido } from "@/lib/affido";
import { rememberCurrentAsPraticheBack, PRATICHE_BACK_KEY } from "@/lib/praticheNavBack";
import { statoOperativoPratica } from "@/lib/statoOperativoPratica";
import { codiceScaricoPratica } from "@/lib/scarico";
import { PaginazioneBar } from "@/components/PaginazioneBar";

const AFFIDA_PAGE_SIZE = 50;

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
  scadenza?: string | Date | null;
  debitoreNome: string;
  assegnatarioId?: string | null;
  assegnatarioNome?: string | null;
  operatoreTitolareId?: string | null;
  operatoreTitolareNome?: string | null;
  codiceScarico?: string | null;
  codiceScaricoBk?: string | null;
};

type SortCol =
  | "numero"
  | "debitore"
  | "assegnatario"
  | "affido"
  | "residuo"
  | "codScarico"
  | "codBk";
type SortDir = "asc" | "desc";

const SORT_COLS: { key: SortCol; label: string }[] = [
  { key: "numero", label: "Pratica" },
  { key: "debitore", label: "Debitore" },
  { key: "assegnatario", label: "Assegnatario" },
  { key: "affido", label: "Affido" },
  { key: "residuo", label: "Residuo" },
  { key: "codScarico", label: "Cod. scarico" },
  { key: "codBk", label: "Cod. bk off" },
];

const SORT_COL_KEYS = new Set<string>(SORT_COLS.map((c) => c.key));

function parseAffidaSort(
  col: string | null | undefined,
  dir: string | null | undefined
): { col: SortCol; dir: SortDir } | null {
  if (!col || !SORT_COL_KEYS.has(col)) return null;
  if (dir !== "asc" && dir !== "desc") return null;
  return { col: col as SortCol, dir };
}

function codScaricoDisplay(p: PraticaDaAffidare) {
  return (codiceScaricoPratica(p.stato, p.codiceScarico) || "").trim();
}

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
    case "codScarico":
      return codScaricoDisplay(a).localeCompare(codScaricoDisplay(b), "it");
    case "codBk":
      return (a.codiceScaricoBk || "").localeCompare(b.codiceScaricoBk || "", "it");
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
  affidaSort,
  affidaDir,
  affidaPage: affidaPageProp,
}: {
  pratiche: PraticaDaAffidare[];
  operatori: Array<{ id: string; name: string }>;
  /** Ordine colonna da URL (`affidaSort`), ripristinato al ritorno dalla pratica. */
  affidaSort?: string | null;
  affidaDir?: string | null;
  affidaPage?: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [sort, setSort] = useState<{ col: SortCol; dir: SortDir } | null>(() =>
    parseAffidaSort(affidaSort, affidaDir)
  );

  useEffect(() => {
    setSort(parseAffidaSort(affidaSort, affidaDir));
  }, [affidaSort, affidaDir]);

  const praticheOrdinate = useMemo(() => {
    if (!sort) return pratiche;
    const sign = sort.dir === "asc" ? 1 : -1;
    return [...pratiche].sort((a, b) => {
      const cmp = comparePratiche(a, b, sort.col);
      if (cmp !== 0) return cmp * sign;
      return a.numero.localeCompare(b.numero, "it", { numeric: true });
    });
  }, [pratiche, sort]);

  const totalPages = Math.max(1, Math.ceil(praticheOrdinate.length / AFFIDA_PAGE_SIZE));
  const pageRaw = Number(affidaPageProp || "1");
  const page = Math.min(totalPages, Math.max(1, Number.isFinite(pageRaw) ? pageRaw : 1));
  const pageRows = useMemo(() => {
    const start = (page - 1) * AFFIDA_PAGE_SIZE;
    return praticheOrdinate.slice(start, start + AFFIDA_PAGE_SIZE);
  }, [praticheOrdinate, page]);

  const { selected, allRef, allChecked, toggleAll, toggleOne } = useSelezionePratiche(
    pageRows.map((p) => p.id)
  );
  const praticheStato = buildPraticheStato(pratiche);

  function hrefWithParams(patch: Record<string, string | null>) {
    const sp = new URLSearchParams(
      typeof window !== "undefined" ? window.location.search : ""
    );
    for (const [k, v] of Object.entries(patch)) {
      if (v == null || v === "") sp.delete(k);
      else sp.set(k, v);
    }
    const qs = sp.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  function toggleSort(col: SortCol) {
    const nextDir: SortDir =
      sort?.col === col ? (sort.dir === "asc" ? "desc" : "asc") : "asc";
    const next = { col, dir: nextDir };
    setSort(next);
    const nextUrl = hrefWithParams({
      affidaSort: next.col,
      affidaDir: next.dir,
      affidaPage: "1",
    });
    router.replace(nextUrl, { scroll: false });
    try {
      sessionStorage.setItem(PRATICHE_BACK_KEY, nextUrl);
    } catch {
      /* ignore */
    }
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

      {praticheOrdinate.length > AFFIDA_PAGE_SIZE ? (
        <p className="mb-2 text-xs text-[var(--muted)]">
          Pagina {page}/{totalPages} · {pageRows.length} di {praticheOrdinate.length} pratiche
          (max {AFFIDA_PAGE_SIZE}/pagina)
        </p>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[880px] text-sm">
          <thead className="text-left text-[var(--muted)]">
            <tr>
              <th className="w-10 py-2 pr-2">
                <CheckboxSelezione
                  inputRef={allRef}
                  checked={allChecked}
                  onChange={toggleAll}
                  label="Seleziona tutte in pagina"
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
            {pageRows.map((p) => {
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
                    <Link
                      className="text-[var(--accent)] underline"
                      href={`/pratiche/${p.id}`}
                      onClick={() => rememberCurrentAsPraticheBack()}
                    >
                      {p.numero}
                    </Link>{" "}
                    <StatoBadge
                      stato={statoOperativoPratica({
                        stato: p.stato,
                        assegnatarioId: p.assegnatarioId,
                        scadenza: p.scadenza,
                        codiceScaricoBk: p.codiceScaricoBk,
                      })}
                    />
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
                  <td className="font-mono text-xs tabular-nums">
                    {codScaricoDisplay(p) || "—"}
                  </td>
                  <td className="font-mono text-xs tabular-nums">
                    {(p.codiceScaricoBk || "").trim() || "—"}
                  </td>
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

      {totalPages > 1 ? (
        <div className="mt-3">
          <PaginazioneBar
            page={page}
            totalPages={totalPages}
            hrefForPage={(p) => hrefWithParams({ affidaPage: String(p) })}
          />
        </div>
      ) : null}
    </div>
  );
}
