"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Calendar } from "lucide-react";
import { FILTRI_PAGE_INPUT_CLASS } from "@/components/filtri/filtriFieldStyles";

const MESI_CORTI = [
  "gen",
  "feb",
  "mar",
  "apr",
  "mag",
  "giu",
  "lug",
  "ago",
  "set",
  "ott",
  "nov",
  "dic",
];

function parseYm(ym: string) {
  const m = /^(\d{4})-(\d{2})$/.exec(ym);
  if (m) return { year: Number(m[1]), month: Number(m[2]) - 1 };
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() };
}

function toYm(year: number, month: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

function labelMese(ym: string) {
  const { year, month } = parseYm(ym);
  return new Date(year, month, 1).toLocaleDateString("it-IT", {
    month: "long",
    year: "numeric",
  });
}

function firefoxBrowser() {
  return typeof navigator !== "undefined" && /firefox/i.test(navigator.userAgent);
}

/** Admin/supervisor: calendario mese (Firefox non supporta il picker nativo di type=month). */
export function ProvvigioniMeseCalendario({
  value,
  inputKey,
}: {
  value: string;
  inputKey?: string;
}) {
  const [useCustom, setUseCustom] = useState(false);
  const [open, setOpen] = useState(false);
  const initial = parseYm(value);
  const [viewYear, setViewYear] = useState(initial.year);
  const [selected, setSelected] = useState(value);
  const wrapRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    setUseCustom(firefoxBrowser());
  }, []);

  useEffect(() => {
    setSelected(value);
    const p = parseYm(value);
    setViewYear(p.year);
  }, [value, inputKey]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  if (!useCustom) {
    return (
      <input
        type="month"
        name="mese"
        key={inputKey}
        defaultValue={value}
        className={`px-3 ${FILTRI_PAGE_INPUT_CLASS} h-10`}
      />
    );
  }

  return (
    <div ref={wrapRef} className="relative" key={inputKey}>
      <input type="hidden" name="mese" value={selected} />
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex h-10 min-w-[11rem] items-center justify-between gap-2 px-3 ${FILTRI_PAGE_INPUT_CLASS}`}
      >
        <span className="truncate">{labelMese(selected)}</span>
        <Calendar className="h-4 w-4 shrink-0 text-[var(--muted)]" />
      </button>
      {open ? (
        <div
          id={panelId}
          className="absolute left-0 top-full z-50 mt-1 w-[17rem] rounded-lg border border-[#7d94a8] bg-white p-3 shadow-lg"
        >
          <div className="mb-2 flex items-center justify-between text-sm font-semibold text-[var(--navy)]">
            <button
              type="button"
              className="rounded px-2 py-0.5 hover:bg-slate-100"
              onClick={() => setViewYear((y) => y - 1)}
              aria-label="Anno precedente"
            >
              ‹
            </button>
            <span>{viewYear}</span>
            <button
              type="button"
              className="rounded px-2 py-0.5 hover:bg-slate-100"
              onClick={() => setViewYear((y) => y + 1)}
              aria-label="Anno successivo"
            >
              ›
            </button>
          </div>
          <div className="grid grid-cols-4 gap-1">
            {MESI_CORTI.map((short, mi) => {
              const ym = toYm(viewYear, mi);
              const isSel = selected === ym;
              return (
                <button
                  key={short}
                  type="button"
                  onClick={() => {
                    setSelected(ym);
                    setOpen(false);
                  }}
                  className={`rounded px-1 py-1.5 text-xs font-medium ${
                    isSel
                      ? "bg-[var(--navy)] text-white"
                      : "text-[var(--navy)] hover:bg-slate-100"
                  }`}
                >
                  {short}
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex justify-between border-t border-[var(--line)] pt-2 text-xs">
            <button
              type="button"
              className="text-[var(--muted)] hover:text-[var(--navy)]"
              onClick={() => setOpen(false)}
            >
              Cancella
            </button>
            <button
              type="button"
              className="font-medium text-[var(--navy)] hover:underline"
              onClick={() => {
                const now = new Date();
                const ym = toYm(now.getFullYear(), now.getMonth());
                setSelected(ym);
                setViewYear(now.getFullYear());
                setOpen(false);
              }}
            >
              Questo mese
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
