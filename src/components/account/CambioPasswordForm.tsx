"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { changePasswordAction } from "@/actions/account";
import { PASSWORD_REQUIREMENTS, validatePasswordComplexity } from "@/lib/passwordRules";

const inputCls =
  "mt-1.5 h-10 w-full rounded-lg border border-[var(--line)] bg-white px-3 text-sm shadow-sm transition focus:border-[#1a4f7a] focus:outline-none focus:ring-2 focus:ring-[#1a4f7a]/15";

export function CambioPasswordForm({
  forced = false,
  onSuccessHref,
  compact = false,
}: {
  forced?: boolean;
  onSuccessHref?: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    setMsg(null);
    setErr(null);

    const currentPassword = String(formData.get("currentPassword") || "");
    const newPassword = String(formData.get("newPassword") || "");
    const confirmPassword = String(formData.get("confirmPassword") || "");

    if (!currentPassword.trim()) {
      setErr("Inserisci la password attuale");
      return;
    }
    if (!newPassword.trim()) {
      setErr("Inserisci la nuova password");
      return;
    }
    const complexityErr = validatePasswordComplexity(newPassword);
    if (complexityErr) {
      setErr(complexityErr);
      return;
    }
    if (!confirmPassword.trim()) {
      setErr("Conferma la nuova password");
      return;
    }
    if (newPassword !== confirmPassword) {
      setErr("La conferma non coincide con la nuova password");
      return;
    }
    if (currentPassword === newPassword) {
      setErr("La nuova password deve essere diversa da quella attuale");
      return;
    }

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
          Password scaduta: inserisci prima la password attuale, poi la nuova due volte per
          confermarla. {PASSWORD_REQUIREMENTS} Non è possibile riutilizzare password già usate.
        </p>
      ) : compact ? null : (
        <p className="text-xs text-[var(--muted)]">
          Per cambiare password servono sempre tre campi: attuale, nuova e conferma.{" "}
          {PASSWORD_REQUIREMENTS} Non è possibile riutilizzare password già usate in passato.
        </p>
      )}

      <fieldset className="space-y-4">
        <legend className="sr-only">Cambio password</legend>

        <label className="block">
          <span className="text-xs font-semibold uppercase text-[var(--muted)]">
            1 · Password attuale
          </span>
          <input
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            required
            className={inputCls}
            placeholder="Password in uso"
          />
        </label>

        <label className="block">
          <span className="text-xs font-semibold uppercase text-[var(--muted)]">
            2 · Nuova password
          </span>
          <input
            name="newPassword"
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            className={inputCls}
            placeholder="Maiuscola + carattere speciale"
          />
        </label>

        <label className="block">
          <span className="text-xs font-semibold uppercase text-[var(--muted)]">
            3 · Conferma nuova password
          </span>
          <input
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            className={inputCls}
            placeholder="Ripeti la nuova password"
          />
        </label>
      </fieldset>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="h-10 rounded-lg bg-[var(--navy)] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1a365d] disabled:opacity-50"
        >
          {pending ? "Aggiorno…" : "Cambia password"}
        </button>
        {msg ? <span className="text-xs font-semibold text-emerald-600">{msg}</span> : null}
        {err ? <span className="text-xs font-semibold text-[var(--danger)]">{err}</span> : null}
      </div>
    </form>
  );
}
