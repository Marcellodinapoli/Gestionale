"use client";

import { useRouter, useSearchParams } from "next/navigation";

export function StatisticheFiltriForm({
  mandanti,
  affidoDa,
  affidoA,
  mandanteId,
  lotto,
  gruppoId,
  supervisori,
}: {
  mandanti: Array<{ id: string; codice: string; ragioneSociale: string }>;
  affidoDa: string;
  affidoA: string;
  mandanteId?: string;
  lotto?: string;
  gruppoId?: string;
  supervisori?: Array<{ id: string; name: string; gruppoNome: string | null }>;
}) {
  const router = useRouter();
  const sp = useSearchParams();

  return (
    <form
      className="mb-3 flex flex-wrap items-end gap-2 rounded-lg border border-[var(--line)] bg-white p-3"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const qs = new URLSearchParams(sp.toString());
        for (const key of ["affidoDa", "affidoA", "mandanteId", "lotto", "gruppo"]) {
          const val = String(fd.get(key) || "").trim();
          if (val) qs.set(key, val);
          else qs.delete(key);
        }
        router.push(`/statistiche?${qs.toString()}`);
      }}
    >
      <label className="text-xs">
        <span className="mb-1 block font-semibold text-[var(--muted)]">Affido da</span>
        <input
          type="date"
          name="affidoDa"
          defaultValue={affidoDa}
          className="h-9 rounded border border-[var(--line)] px-2 text-sm"
        />
      </label>
      <label className="text-xs">
        <span className="mb-1 block font-semibold text-[var(--muted)]">Affido a</span>
        <input
          type="date"
          name="affidoA"
          defaultValue={affidoA}
          className="h-9 rounded border border-[var(--line)] px-2 text-sm"
        />
      </label>
      <label className="text-xs">
        <span className="mb-1 block font-semibold text-[var(--muted)]">Mandato</span>
        <select
          name="mandanteId"
          defaultValue={mandanteId || ""}
          className="h-9 min-w-[140px] rounded border border-[var(--line)] px-2 text-sm"
        >
          <option value="">Tutti</option>
          {mandanti.map((m) => (
            <option key={m.id} value={m.id}>
              {m.codice}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs">
        <span className="mb-1 block font-semibold text-[var(--muted)]">Perimetro</span>
        <input
          name="lotto"
          defaultValue={lotto || ""}
          placeholder="Perimetro / lotto"
          className="h-9 w-36 rounded border border-[var(--line)] px-2 text-sm"
        />
      </label>
      {supervisori && supervisori.length > 0 && (
        <label className="text-xs">
          <span className="mb-1 block font-semibold text-[var(--muted)]">Gruppo</span>
          <select
            name="gruppo"
            defaultValue={gruppoId || ""}
            className="h-9 min-w-[160px] rounded border border-[var(--line)] px-2 text-sm"
          >
            <option value="">Tutti i gruppi</option>
            {supervisori.map((s) => (
              <option key={s.id} value={s.id}>
                {s.gruppoNome || s.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <button
        type="submit"
        className="h-9 rounded border border-[var(--line)] bg-[#eef2f6] px-4 text-sm font-medium hover:bg-[#dce4ec]"
      >
        Aggiorna
      </button>
    </form>
  );
}
