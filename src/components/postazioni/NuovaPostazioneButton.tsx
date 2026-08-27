"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Modal } from "@/components/Modal";
import { creaPostazioneAction } from "@/actions/postazione";

const inputCls =
  "mt-1 h-9 w-full rounded-lg border border-[var(--line)] px-3 text-sm";
const labelCls = "text-[10px] font-semibold uppercase text-[var(--muted)]";

type SedeOpt = { id: string; nome: string };

export function NuovaPostazioneButton({ sedi }: { sedi: SedeOpt[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await creaPostazioneAction(formData);
        setOpen(false);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Errore creazione postazione");
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
        Crea nuova postazione
      </button>

      <Modal
        open={open}
        title="Nuova postazione"
        onClose={() => !pending && setOpen(false)}
        wide
      >
        <form
          action={onSubmit}
          className="grid gap-3 p-4 text-sm sm:grid-cols-2 lg:grid-cols-3"
        >
          <label>
            <span className={labelCls}>Nome / Codice *</span>
            <input
              name="nome"
              required
              autoFocus
              className={inputCls}
              placeholder="es. PC-01"
            />
          </label>
          <label>
            <span className={labelCls}>Sede *</span>
            <select name="sedeId" required className={inputCls} defaultValue="">
              <option value="" disabled>
                Seleziona sede…
              </option>
              {sedi.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nome}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className={labelCls}>Interno</span>
            <input name="interno" className={inputCls} placeholder="es. 201" />
          </label>
          <label>
            <span className={labelCls}>Email postazione</span>
            <input
              name="email"
              type="email"
              className={inputCls}
              placeholder="pc01@azienda.it"
            />
          </label>
          <label>
            <span className={labelCls}>Numero fisso</span>
            <input
              name="numeroFisso"
              className={inputCls}
              placeholder="es. 06 1234567"
            />
          </label>
          <label>
            <span className={labelCls}>Note</span>
            <input name="note" className={inputCls} />
          </label>

          {error ? (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 sm:col-span-2 lg:col-span-3">
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap justify-end gap-2 sm:col-span-2 lg:col-span-3">
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
              disabled={pending || sedi.length === 0}
              className="h-9 rounded-lg bg-[var(--navy)] px-4 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
            >
              {pending ? "Salvataggio…" : "Crea postazione"}
            </button>
          </div>
          {sedi.length === 0 ? (
            <p className="text-sm text-amber-800 sm:col-span-2 lg:col-span-3">
              Crea prima almeno una sede attiva.
            </p>
          ) : null}
        </form>
      </Modal>
    </>
  );
}
