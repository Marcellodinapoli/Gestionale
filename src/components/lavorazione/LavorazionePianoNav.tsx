"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { formatDataIso } from "@/lib/lavorateOggiUi";
import { LavorazioneAggiornaButton } from "@/components/lavorazione/LavorazioneRefresh";
import { Card } from "@/components/ui";
import {
  FILTRI_PAGE_INPUT_CLASS,
  FILTRI_PAGE_SELECT_CLASS,
} from "@/components/filtri/filtriFieldStyles";

function buildHref(
  giorno: string,
  gruppo?: string,
  opts?: { nuovo?: boolean }
) {
  const sp = new URLSearchParams();
  sp.set("giorno", giorno);
  if (opts?.nuovo) sp.set("nuovo", "1");
  if (gruppo) sp.set("gruppo", gruppo);
  return `/lavorazione?${sp.toString()}${opts?.nuovo ? "#piano-lavorazione" : ""}`;
}

function labelGiorno(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("it-IT", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function domaniIso() {
  return formatDataIso(new Date(Date.now() + 86400000));
}

export function LavorazionePianoNav({
  dataPiano,
  datePiani,
  gruppoId,
  canEdit,
}: {
  dataPiano: string;
  datePiani: string[];
  gruppoId?: string;
  canEdit?: boolean;
}) {
  const router = useRouter();
  const oggi = formatDataIso(new Date());
  const dateUniche = [...new Set([...datePiani, dataPiano, oggi])].sort((a, b) =>
    b.localeCompare(a)
  );
  const [cardAperta, setCardAperta] = useState(false);
  const [nuovaData, setNuovaData] = useState(domaniIso);

  function apriCardNuovoPiano() {
    setNuovaData(domaniIso());
    setCardAperta(true);
  }

  function creaPiano() {
    const iso = nuovaData.trim();
    if (!iso || Number.isNaN(new Date(`${iso}T12:00:00`).getTime())) return;
    setCardAperta(false);
    router.push(buildHref(iso, gruppoId, { nuovo: true }));
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3 rounded-xl border border-[var(--line)] bg-[#f8fafc] px-3 py-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="mb-1 block text-xs font-semibold uppercase text-[var(--muted)]">
              Giorno lavorazione
            </span>
            <input
              type="date"
              value={dataPiano}
              onChange={(e) => {
                const v = e.target.value;
                if (v) router.push(buildHref(v, gruppoId));
              }}
              className={FILTRI_PAGE_INPUT_CLASS}
            />
          </label>

          {dateUniche.length > 1 ? (
            <label className="text-sm">
              <span className="mb-1 block text-xs font-semibold uppercase text-[var(--muted)]">
                Piani salvati
              </span>
              <select
                value={dataPiano}
                onChange={(e) => router.push(buildHref(e.target.value, gruppoId))}
                className={`min-w-[12rem] ${FILTRI_PAGE_SELECT_CLASS}`}
              >
                {dateUniche.map((d) => (
                  <option key={d} value={d}>
                    {labelGiorno(d)}
                    {d === oggi ? " · oggi" : ""}
                    {!datePiani.includes(d) && d !== dataPiano ? " (nuovo)" : ""}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {canEdit ? (
            <button
              type="button"
              onClick={apriCardNuovoPiano}
              className={`flex h-9 items-center gap-1 rounded-lg px-3 text-sm font-medium ${
                cardAperta
                  ? "bg-[var(--navy)] text-white"
                  : "border border-[var(--line)] bg-white hover:bg-slate-50"
              }`}
            >
              <Plus className="h-4 w-4" /> Nuovo piano
            </button>
          ) : null}
        </div>

        <LavorazioneAggiornaButton className="pb-0.5" />
      </div>

      {cardAperta && canEdit ? (
        <Card title="Nuovo piano di lavorazione">
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-sm">
              <span className="mb-1 block text-xs font-semibold text-[var(--muted)]">
                Data lavorazione
              </span>
              <input
                type="date"
                value={nuovaData}
                onChange={(e) => setNuovaData(e.target.value)}
                className="h-10 rounded-lg border border-[var(--line)] bg-white px-3 text-sm"
                autoFocus
              />
            </label>
            <button
              type="button"
              onClick={creaPiano}
              disabled={!nuovaData}
              className="h-10 rounded-lg bg-[var(--navy)] px-4 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              Apri piano
            </button>
            <button
              type="button"
              onClick={() => setCardAperta(false)}
              className="inline-flex h-10 items-center gap-1 rounded-lg border border-[var(--line)] bg-white px-3 text-sm font-medium text-[var(--muted)] hover:bg-slate-50"
            >
              <X className="h-4 w-4" /> Annulla
            </button>
          </div>
          <p className="mt-3 text-xs text-[var(--muted)]">
            Dopo «Apri piano» compila le righe nella card sotto e salva per pubblicarlo.
          </p>
        </Card>
      ) : null}
    </div>
  );
}
