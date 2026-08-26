"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Modal } from "@/components/Modal";
import { creaSedeAction } from "@/actions/sedi";

const inputCls =
  "mt-1 h-9 w-full rounded-lg border border-[var(--line)] px-3 text-sm";
const labelCls = "text-[10px] font-semibold uppercase text-[var(--muted)]";

export function NuovaSedeButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await creaSedeAction(formData);
        setOpen(false);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Errore creazione sede");
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[var(--navy)] px-3 text-sm font-semibold text-white hover:opacity-90"
      >
        <Plus className="h-4 w-4" />
        Crea nuova sede
      </button>

      <Modal open={open} title="Nuova sede" onClose={() => !pending && setOpen(false)} wide>
        <form action={onSubmit} className="grid gap-3 p-4 text-sm sm:grid-cols-2">
          <label className="sm:col-span-2">
            <span className={labelCls}>Nome sede *</span>
            <input
              name="nome"
              required
              autoFocus
              className={inputCls}
              placeholder="es. Roma, Milano, Napoli"
            />
          </label>
          <label className="sm:col-span-2">
            <span className={labelCls}>Indirizzo</span>
            <input name="indirizzo" className={inputCls} placeholder="Via / Piazza" />
          </label>
          <label>
            <span className={labelCls}>Città</span>
            <input name="citta" className={inputCls} />
          </label>
          <label>
            <span className={labelCls}>CAP</span>
            <input name="cap" className={inputCls} maxLength={10} />
          </label>
          <label>
            <span className={labelCls}>Provincia</span>
            <input name="provincia" className={inputCls} maxLength={4} placeholder="RM" />
          </label>
          <label>
            <span className={labelCls}>Telefono</span>
            <input name="telefono" className={inputCls} />
          </label>
          <label className="sm:col-span-2">
            <span className={labelCls}>Email</span>
            <input name="email" type="email" className={inputCls} />
          </label>
          <label className="sm:col-span-2">
            <span className={labelCls}>Note</span>
            <input name="note" className={inputCls} placeholder="Orari, riferimenti…" />
          </label>

          {error ? (
            <p className="sm:col-span-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap justify-end gap-2 sm:col-span-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => setOpen(false)}
              className="h-9 rounded-lg border border-[var(--line)] bg-white px-4 text-sm font-medium text-[var(--navy)] hover:bg-slate-50 disabled:opacity-60"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={pending}
              className="h-9 rounded-lg bg-[var(--navy)] px-4 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
            >
              {pending ? "Salvataggio…" : "Crea sede"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
