"use client";

import { useState, useTransition } from "react";
import { ruoliCreabiliDa, ROLE_LABELS, type Role } from "@/lib/permissions";
import { createOperatoreAction } from "@/actions/operatoriAdmin";

type SedeOpt = { id: string; nome: string };
type SupervisorOpt = { id: string; name: string };

export function NuovoOperatoreForm({
  creatorRole,
  sedi,
  supervisori,
  onSuccess,
  onCancel,
}: {
  creatorRole: Role;
  sedi: SedeOpt[];
  supervisori: SupervisorOpt[];
  onSuccess?: () => void;
  onCancel?: () => void;
}) {
  const ruoli = ruoliCreabiliDa(creatorRole);
  const [accesso, setAccesso] = useState<"completo" | "formazione">("completo");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const soloFormazione = accesso === "formazione";

  const inputCls = "mt-1 h-9 w-full rounded-lg border border-[var(--line)] px-3 text-sm";

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await createOperatoreAction(formData);
        onSuccess?.();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Errore durante la creazione");
      }
    });
  }

  return (
    <form action={onSubmit} className="flex flex-wrap items-end gap-3 text-sm">
      <label className="min-w-[150px] flex-1">
        <span className="text-[10px] font-semibold uppercase text-[var(--muted)]">Nome</span>
        <input name="name" required className={inputCls} />
      </label>
      <label className="min-w-[180px] flex-1">
        <span className="text-[10px] font-semibold uppercase text-[var(--muted)]">Email</span>
        <input name="email" type="email" required className={inputCls} />
      </label>
      <label className="w-32">
        <span className="text-[10px] font-semibold uppercase text-[var(--muted)]">Password</span>
        <input name="password" type="password" required minLength={6} className={inputCls} />
      </label>
      <label className="w-28">
        <span className="text-[10px] font-semibold uppercase text-[var(--muted)]">Acronimo</span>
        <input
          name="acronimo"
          maxLength={6}
          className={`${inputCls} uppercase`}
          placeholder="es. MR"
        />
      </label>
      <label className="w-44">
        <span className="text-[10px] font-semibold uppercase text-[var(--muted)]">Accesso</span>
        <select
          name="accesso"
          className={inputCls}
          value={accesso}
          onChange={(e) => setAccesso(e.target.value as "completo" | "formazione")}
        >
          <option value="completo">Completo</option>
          <option value="formazione">Solo formazione</option>
        </select>
      </label>
      {!soloFormazione ? (
        <label className="w-40">
          <span className="text-[10px] font-semibold uppercase text-[var(--muted)]">Ruolo</span>
          <select name="role" className={inputCls} defaultValue="OPERATOR">
            {ruoli.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <input type="hidden" name="role" value="OPERATOR" />
      )}
      {!soloFormazione ? (
        <label className="w-44">
          <span className="text-[10px] font-semibold uppercase text-[var(--muted)]">Supervisor</span>
          <select name="supervisorId" className={inputCls}>
            <option value="">—</option>
            {supervisori.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <label className="w-44">
        <span className="text-[10px] font-semibold uppercase text-[var(--muted)]">Sede</span>
        <select name="sedeId" className={inputCls} required>
          <option value="">—</option>
          {sedi.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nome}
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        disabled={pending}
        className="h-9 rounded-lg bg-[var(--navy)] px-4 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Creazione…" : "Crea"}
      </button>
      {onCancel ? (
        <button
          type="button"
          disabled={pending}
          onClick={onCancel}
          className="h-9 rounded-lg border border-[var(--line)] bg-white px-4 text-sm font-medium text-[var(--navy)] hover:bg-slate-50 disabled:opacity-60"
        >
          Annulla
        </button>
      ) : null}
      {error ? (
        <p className="w-full rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
          {error}
        </p>
      ) : null}
      {soloFormazione ? (
        <p className="w-full text-xs text-[var(--muted)]">
          L&apos;account avrà accesso solo alla Formazione (nessuna postazione, pratiche né Strumenti AI).
        </p>
      ) : null}
    </form>
  );
}
