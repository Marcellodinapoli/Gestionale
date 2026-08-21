import type { ReactNode } from "react";
import Link from "next/link";

const PAGE_SIZE = 25;

export function paginateParams(pageRaw?: string) {
  const page = Math.max(1, Number(pageRaw) || 1);
  return { page, pageSize: PAGE_SIZE, skip: (page - 1) * PAGE_SIZE };
}

export function buildPraticheQuery(params: {
  q?: string;
  stato?: string;
  esito?: string;
  lavorate?: boolean;
  lavorateData?: string;
  lavorateOggi?: boolean;
  nonToccateDa?: 7 | 15;
  sort?: string;
  dir?: string;
  page?: number;
  [key: string]: string | boolean | number | undefined;
}) {
  const sp = new URLSearchParams();
  if (params.q) sp.set("q", String(params.q));
  if (params.stato) sp.set("stato", String(params.stato));
  if (params.esito) sp.set("esito", String(params.esito));
  if (params.lavorate) sp.set("lavorate", "1");
  if (params.lavorateData) sp.set("lavorateData", String(params.lavorateData));
  else if (params.lavorateOggi) sp.set("lavorateOggi", "1");
  if (params.lavorateFascia) sp.set("lavorateFascia", String(params.lavorateFascia));
  if (params.nonToccateDa) sp.set("nonToccateDa", String(params.nonToccateDa));
  if (params.sort) sp.set("sort", String(params.sort));
  if (params.dir) sp.set("dir", String(params.dir));
  if (params.page && Number(params.page) > 1) sp.set("page", String(params.page));

  const altriKeys = [
    "debitore",
    "capDa",
    "capA",
    "citta",
    "prov",
    "telefono",
    "affidoDa",
    "affidoA",
    "scadenzaDa",
    "scadenzaA",
    "mandato",
    "lotto",
    "operatore",
    "codScarico",
    "sitAffido",
    "affidoProvvisorio",
    "importoRataDa",
    "importoRataA",
    "residuoDa",
    "residuoA",
    "totIncassatoDa",
    "totIncassatoA",
    "importoTotDa",
    "importoTotA",
    "cfPiva",
    "garante",
    "note",
    "nPraticaDa",
    "nPraticaA",
    "promPagDa",
    "promPagA",
    "incassatoDa",
    "incassatoA",
    "memoDa",
    "memoA",
    "aggiuntivo",
  ] as const;
  for (const k of altriKeys) {
    const v = params[k];
    if (v !== undefined && v !== "" && v !== false) sp.set(k, String(v));
  }

  const qs = sp.toString();
  return qs ? `/pratiche?${qs}` : "/pratiche";
}

export function PaginazioneBar({
  page,
  totalPages,
  hrefForPage,
  fixed,
  left,
  right,
  labels = {
    first: "Prima pagina",
    prev: "Pagina precedente",
    next: "Pagina successiva",
    last: "Ultima pagina",
  },
}: {
  page: number;
  totalPages: number;
  hrefForPage: (page: number) => string;
  fixed?: boolean;
  left?: ReactNode;
  right?: ReactNode;
  labels?: { first: string; prev: string; next: string; last: string };
}) {
  const atFirst = page <= 1;
  const atLast = page >= totalPages;
  const single = totalPages <= 1;

  const btnActive =
    "inline-flex h-7 min-w-[28px] items-center justify-center border border-[#8a8a8a] bg-gradient-to-b from-[#f0f0f0] to-[#c8c8c8] px-1.5 text-sm font-bold text-[#1a1a1a] shadow-[inset_0_1px_0_#fff] hover:from-[#fafafa] hover:to-[#d8d8d8]";
  const btnDisabled =
    "inline-flex h-7 min-w-[28px] cursor-not-allowed items-center justify-center border border-[#b0b0b0] bg-[#d8d8d8] px-1.5 text-sm font-bold text-[#888] opacity-70";

  const paginationButtons = (
    <div className="flex items-center gap-1">
      {atFirst ? (
        <>
          <span
            className={btnDisabled}
            title={single ? "Unica pratica disponibile" : "Sei già alla prima"}
            aria-disabled
          >
            «
          </span>
          <span
            className={btnDisabled}
            title={single ? "Unica pratica disponibile" : "Nessuna pratica precedente"}
            aria-disabled
          >
            ‹
          </span>
        </>
      ) : (
        <>
          <Link href={hrefForPage(1)} className={btnActive} title={labels.first}>
            «
          </Link>
          <Link href={hrefForPage(page - 1)} className={btnActive} title={labels.prev}>
            ‹
          </Link>
        </>
      )}

      <span className="mx-1 inline-flex h-7 min-w-[52px] items-center justify-center border border-[#b8a080] bg-[#f5dcc8] px-2 text-sm font-bold text-[#1a365d]">
        {page}/{totalPages}
      </span>

      {atLast ? (
        <>
          <span
            className={btnDisabled}
            title={single ? "Unica pratica disponibile" : "Sei già all'ultima"}
            aria-disabled
          >
            ›
          </span>
          <span
            className={btnDisabled}
            title={single ? "Unica pratica disponibile" : "Nessuna pratica successiva"}
            aria-disabled
          >
            »
          </span>
        </>
      ) : (
        <>
          <Link href={hrefForPage(page + 1)} className={btnActive} title={labels.next}>
            ›
          </Link>
          <Link href={hrefForPage(totalPages)} className={btnActive} title={labels.last}>
            »
          </Link>
        </>
      )}
    </div>
  );

  return (
    <div
      className={`border-t border-[var(--line)] bg-[#e8e8e8] px-2 py-1 sm:px-3 ${
        fixed ? "fixed inset-x-0 bottom-0 z-40 shadow-[0_-2px_8px_rgba(0,0,0,0.08)]" : ""
      }`}
    >
      {left || right ? (
        <div className="flex flex-col gap-2 py-0.5 sm:relative sm:min-h-8 sm:flex-row sm:items-center sm:gap-0 sm:py-0">
          <div className="relative z-10 flex min-w-0 shrink-0 items-center justify-start sm:max-w-[40%]">
            {left}
          </div>
          <div className="flex items-center justify-center sm:pointer-events-none sm:absolute sm:inset-x-0">
            <div className="pointer-events-auto">{paginationButtons}</div>
          </div>
          <div className="relative z-10 flex min-w-0 shrink-0 items-center justify-end sm:ml-auto sm:max-w-[40%]">
            {right}
          </div>
        </div>
      ) : (
        <div className="flex min-h-8 items-center justify-center">{paginationButtons}</div>
      )}
      {single && !left && !right ? (
        <p className="pb-0.5 text-center text-[10px] text-[var(--muted)]">
          Unica pratica in coda — frecce non attive
        </p>
      ) : null}
    </div>
  );
}

export { PAGE_SIZE as PRATICHE_PAGE_SIZE };
