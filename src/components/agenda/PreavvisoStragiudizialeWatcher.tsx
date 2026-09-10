"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  PREAVVISO_STRAGIUDIZIALE_GG_LAVORATIVI,
  PREAVVISO_STRAGIUDIZIALE_PARAM,
} from "@/lib/scadenzaStragiudiziale";

const STORAGE_KEY = "credixa.preavvisoStragiudiziale.snoozeDay";

function todayKey() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function isSnoozedToday() {
  try {
    return localStorage.getItem(STORAGE_KEY) === todayKey();
  } catch {
    return false;
  }
}

function snoozeToday() {
  try {
    localStorage.setItem(STORAGE_KEY, todayKey());
  } catch {
    /* ignore */
  }
}

type Summary = {
  count: number;
  ggLavorativi: number;
  listHref: string;
};

export function PreavvisoStragiudizialeWatcher() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (isSnoozedToday()) return;

    fetch("/api/preavviso-stragiudiziale", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: Summary | null) => {
        if (cancelled || !data || !data.count) return;
        setSummary(data);
        setOpen(true);
      })
      .catch(() => {
        /* ignore */
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!open || !summary || summary.count < 1) return null;

  const gg = summary.ggLavorativi || PREAVVISO_STRAGIUDIZIALE_GG_LAVORATIVI;
  const href =
    summary.listHref || `/pratiche?${PREAVVISO_STRAGIUDIZIALE_PARAM}=1`;

  return (
    <div className="fixed bottom-4 left-4 z-[100] w-[min(420px,calc(100vw-2rem))] border-2 border-amber-700 bg-[#fffbeb] shadow-2xl">
      <div className="flex items-center justify-between bg-amber-800 px-2 py-1 text-xs font-bold text-white">
        <span>Scadenza stragiudiziale</span>
        <button
          type="button"
          className="px-1 leading-none hover:bg-white/20"
          aria-label="Chiudi"
          onClick={() => {
            snoozeToday();
            setOpen(false);
          }}
        >
          ×
        </button>
      </div>
      <div className="space-y-2 px-3 py-3 text-sm text-[#132033]">
        <p>
          Hai <strong>{summary.count}</strong>{" "}
          {summary.count === 1 ? "pratica" : "pratiche"} in dirittura di
          scadenza stragiudiziale (entro {gg} giorni lavorativi) o già scadute,
          ancora da gestire per l&apos;eventuale giudiziale.
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          <Link
            href={href}
            className="inline-flex h-9 items-center rounded-lg bg-amber-800 px-3 text-sm font-semibold text-white hover:bg-amber-900"
            onClick={() => {
              snoozeToday();
              setOpen(false);
            }}
          >
            Apri elenco in dirittura
          </Link>
          <button
            type="button"
            className="inline-flex h-9 items-center rounded-lg border border-amber-700 bg-white px-3 text-sm font-semibold text-amber-900 hover:bg-amber-50"
            onClick={() => {
              snoozeToday();
              setOpen(false);
            }}
          >
            Ricorda domani
          </button>
        </div>
      </div>
    </div>
  );
}
