import type { ReactNode } from "react";
import Link from "next/link";
import { buildPraticheQuery } from "@/lib/buildPraticheQuery";

export { buildPraticheQuery };

const PAGE_SIZE = 25;

export function paginateParams(pageRaw?: string) {
  const page = Math.max(1, Number(pageRaw) || 1);
  return { page, pageSize: PAGE_SIZE, skip: (page - 1) * PAGE_SIZE };
}

export function PaginazioneBar({
  page,
  totalPages,
  hrefForPage,
  onPageLinkClick,
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
  onPageLinkClick?: (href: string) => void;
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

  function pageLink(targetPage: number, className: string, title: string, children: ReactNode) {
    const href = hrefForPage(targetPage);
    if (onPageLinkClick) {
      return (
        <Link
          href={href}
          className={className}
          title={title}
          onClick={() => onPageLinkClick(href)}
        >
          {children}
        </Link>
      );
    }
    return (
      <Link href={href} className={className} title={title}>
        {children}
      </Link>
    );
  }

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
          {pageLink(1, btnActive, labels.first, "«")}
          {pageLink(page - 1, btnActive, labels.prev, "‹")}
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
          {pageLink(page + 1, btnActive, labels.next, "›")}
          {pageLink(totalPages, btnActive, labels.last, "»")}
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
          <div className="relative z-10 flex min-w-0 shrink-0 items-center justify-end pr-14 sm:ml-auto sm:max-w-[40%]">
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
