"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { Printer } from "lucide-react";
import { paginateA4 } from "@/lib/a4Paginate";
import { useEscBack } from "@/lib/useEscBack";

const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const MARGIN_Y_MM = 10;
const PAGE_BODY_MM = A4_HEIGHT_MM - MARGIN_Y_MM * 2;

function mmToPx(mm: number) {
  const probe = document.createElement("div");
  probe.style.height = `${mm}mm`;
  probe.style.position = "absolute";
  probe.style.visibility = "hidden";
  document.body.appendChild(probe);
  const height = probe.offsetHeight;
  probe.remove();
  return height || (mm * 96) / 25.4;
}

export function StampaAnteprima({
  praticaId,
  children,
}: {
  praticaId: string;
  children: ReactNode;
}) {
  const measureRef = useRef<HTMLDivElement>(null);
  useEscBack(`/pratiche/${praticaId}`);
  const [pageCount, setPageCount] = useState(1);
  const [pagePx, setPagePx] = useState(0);
  const [html, setHtml] = useState("");

  useLayoutEffect(() => {
    const el = measureRef.current;
    if (!el) return;

    const measure = () => {
      const nextPagePx = mmToPx(PAGE_BODY_MM);
      const result = paginateA4(el, nextPagePx);
      setPagePx(nextPagePx);
      setPageCount(result.pageCount);
      setHtml(result.html);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [children]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#5c6570] print:h-auto print:bg-white">
      <div className="z-20 flex shrink-0 flex-wrap items-center justify-between gap-3 bg-[#132033] px-3 py-3 text-white sm:px-4 print:hidden">
        <p className="text-sm font-semibold">
          Anteprima di stampa · {pageCount} {pageCount === 1 ? "foglio" : "fogli"} A4
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/pratiche/${praticaId}`}
            className="inline-flex h-10 items-center rounded border border-white/30 px-4 text-sm text-white hover:bg-white/10"
          >
            ← Torna alla pratica (Esc)
          </Link>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex h-10 items-center gap-2 rounded bg-[#e8c547] px-5 text-sm font-bold text-[#132033] shadow-md hover:bg-[#f0d56a]"
          >
            <Printer className="h-4 w-4" />
            Stampa
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-4 py-6 print:hidden">
        <div
          ref={measureRef}
          aria-hidden
          className="pointer-events-none invisible fixed left-[-9999px] top-0 w-[210mm] px-[14mm]"
        >
          {children}
        </div>

        <div className="mx-auto flex w-full max-w-[210mm] flex-col items-center gap-6">
          {Array.from({ length: pageCount }, (_, index) => (
            <div key={index} className="w-full">
              <div
                className="relative overflow-hidden bg-white text-[#132033] shadow-[0_8px_30px_rgba(0,0,0,0.35)]"
                style={{
                  width: `${A4_WIDTH_MM}mm`,
                  height: `${A4_HEIGHT_MM}mm`,
                  paddingTop: `${MARGIN_Y_MM}mm`,
                  paddingBottom: `${MARGIN_Y_MM}mm`,
                }}
              >
                <div className="relative h-full overflow-hidden">
                  <div
                    className="absolute left-0 top-0 w-full px-[14mm]"
                    style={{ transform: pagePx ? `translateY(-${index * pagePx}px)` : undefined }}
                    dangerouslySetInnerHTML={html ? { __html: html } : undefined}
                  />
                </div>
              </div>
              <p className="mt-2 text-center text-[11px] font-medium text-white/80">
                Foglio {index + 1} di {pageCount} · A4
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="stampa-print hidden print:block print:bg-white">{children}</div>
    </div>
  );
}
