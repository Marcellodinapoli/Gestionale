"use client";

import { useRouter } from "next/navigation";
import {
  FILTRI_APPLY_BUTTON_CLASS,
  FILTRI_BAR_CONTAINER_CLASS,
  FILTRI_PAGE_SELECT_CLASS,
} from "@/components/filtri/filtriFieldStyles";

export function HomeGruppoPicker({
  supervisori,
  gruppoId,
  lavorateData,
}: {
  supervisori: Array<{ id: string; name: string; gruppoNome: string | null }>;
  gruppoId: string;
  lavorateData?: string;
}) {
  const router = useRouter();

  if (supervisori.length <= 1) return null;

  return (
    <form
      className={`flex flex-wrap items-end gap-2 rounded-xl px-3 py-3 ${FILTRI_BAR_CONTAINER_CLASS}`}
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const gruppo = String(fd.get("gruppo") || "").trim();
        const qs = new URLSearchParams();
        if (gruppo) qs.set("gruppo", gruppo);
        const data = String(fd.get("lavorateData") || "").trim();
        if (data) qs.set("lavorateData", data);
        router.push(qs.size ? `/?${qs.toString()}` : "/");
      }}
    >
      <label className="text-sm">
        <span className="mb-1 block text-xs font-semibold uppercase text-[var(--muted)]">
          Gruppo
        </span>
        <select
          name="gruppo"
          defaultValue={gruppoId}
          className={`min-w-[12rem] ${FILTRI_PAGE_SELECT_CLASS}`}
        >
          {supervisori.map((s) => (
            <option key={s.id} value={s.id}>
              {s.gruppoNome || s.name}
            </option>
          ))}
        </select>
      </label>
      {lavorateData ? <input type="hidden" name="lavorateData" value={lavorateData} /> : null}
      <button type="submit" className={FILTRI_APPLY_BUTTON_CLASS}>
        Mostra
      </button>
    </form>
  );
}
