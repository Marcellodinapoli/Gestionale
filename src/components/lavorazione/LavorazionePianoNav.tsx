"use client";

import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { formatDataIso } from "@/lib/lavorateOggi";
import { LavorazioneAggiornaButton } from "@/components/lavorazione/LavorazioneRefresh";

function buildHref(giorno: string, gruppo?: string) {
  const sp = new URLSearchParams();
  sp.set("giorno", giorno);
  if (gruppo) sp.set("gruppo", gruppo);
  return `/lavorazione?${sp.toString()}`;
}

function labelGiorno(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("it-IT", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
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

  return (
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
          className="h-9 rounded-lg border border-[var(--line)] bg-white px-2 text-sm"
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
            className="h-9 min-w-[12rem] rounded-lg border border-[var(--line)] bg-white px-2 text-sm"
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
          onClick={() => {
            const raw = window.prompt(
              "Data del nuovo piano di lavorazione (gg/mm/aaaa)",
              new Date(Date.now() + 86400000).toLocaleDateString("it-IT")
            );
            if (!raw) return;
            const parts = raw.trim().split(/[/.-]/);
            if (parts.length !== 3) return;
            const [dd, mm, yyyy] = parts;
            const iso = `${yyyy.padStart(4, "0")}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
            if (Number.isNaN(new Date(`${iso}T12:00:00`).getTime())) return;
            router.push(buildHref(iso, gruppoId));
          }}
          className="flex h-9 items-center gap-1 rounded-lg border border-[var(--line)] bg-white px-3 text-sm font-medium hover:bg-slate-50"
        >
          <Plus className="h-4 w-4" /> Nuovo piano
        </button>
      ) : null}

      {!datePiani.includes(dataPiano) && canEdit ? (
        <p className="pb-1 text-xs text-amber-700">
          Piano non ancora salvato · compila le righe e clicca Salva
        </p>
      ) : null}
      </div>

      <LavorazioneAggiornaButton className="pb-0.5" />
    </div>
  );
}
