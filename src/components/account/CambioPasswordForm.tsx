"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { changePasswordAction } from "@/actions/account";

const inputCls =
  "mt-1 h-9 w-full rounded-lg border border-[var(--line)] bg-white px-3 text-sm";

export function CambioPasswordForm({
  forced = false,
  onSuccessHref,
}: {
  forced?: boolean;
  onSuccessHref?: string;
}) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    setMsg(null);
    setErr(null);
    startTransition(async () => {
      try {
        await changePasswordAction(formData);
        setMsg("Password aggiornata");
        (document.getElementById("password-form") as HTMLFormElement | null)?.reset();
        if (onSuccessHref) {
          router.replace(onSuccessHref);
          router.refresh();
        } else {
          router.refresh();
        }
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Errore");
      }
    });
  }

  return (
    <form id="password-form" action={onSubmit} className="space-y-4 text-sm">
      {forced ? (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-amber-950">
          La password è scaduta (validità 30 giorni). Impostane una nuova: non può essere uguale
          a una già usata in passato.
        </p>
      ) : (
        <p className="text-xs text-[var(--muted)]">
          La password scade ogni 30 giorni e non può essere riusata.
        </p>
      )}

      <label className="block">
        <span className="text-xs font-semibold uppercase text-[var(--muted)]">
          Password attuale
        </span>
        <input
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
          className={inputCls}
        />
      </label>
      <label className="block">
        <span className="text-xs font-semibold uppercase text-[var(--muted)]">
          Nuova password
        </span>
        <input
          name="newPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={6}
          className={inputCls}
        />
      </label>
      <label className="block">
        <span className="text-xs font-semibold uppercase text-[var(--muted)]">
          Conferma nuova password
        </span>
        <input
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={6}
          className={inputCls}
        />
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="h-9 rounded-lg border border-[var(--line)] bg-[var(--navy)] px-4 text-sm font-semibold text-white hover:bg-[#1a365d] disabled:opacity-50"
        >
          {pending ? "Aggiorno..." : "Cambia password"}
        </button>
        {msg ? <span className="text-xs font-semibold text-emerald-600">{msg}</span> : null}
        {err ? <span className="text-xs font-semibold text-[var(--danger)]">{err}</span> : null}
      </div>
    </form>
  );
}
