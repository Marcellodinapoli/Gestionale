"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  PASSWORD_REQUIREMENTS,
  validatePasswordComplexity,
} from "@/lib/passwordRules";

const inputCls =
  "mt-1 h-11 w-full rounded-lg border border-[var(--line)] px-3 text-sm shadow-sm transition focus:border-[#1a4f7a] focus:outline-none focus:ring-2 focus:ring-[#1a4f7a]/15";

type PreviewState =
  | { status: "loading" }
  | { status: "invalid" }
  | { status: "ready"; email: string };

export function AttivaAccountForm({ token }: { token: string }) {
  const router = useRouter();
  const [preview, setPreview] = useState<PreviewState>(() =>
    token ? { status: "loading" } : { status: "invalid" }
  );
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!token) {
      setPreview({ status: "invalid" });
      return;
    }
    let cancelled = false;
    setPreview({ status: "loading" });
    setError(null);

    (async () => {
      try {
        const res = await fetch(
          `/api/auth/invite-preview?token=${encodeURIComponent(token)}`,
          { credentials: "same-origin" }
        );
        const data = (await res.json().catch(() => ({}))) as {
          email?: string;
          code?: string;
        };
        if (cancelled) return;
        if (!res.ok || !data.email) {
          setPreview({ status: "invalid" });
          return;
        }
        setPreview({ status: "ready", email: data.email });
      } catch {
        if (!cancelled) setPreview({ status: "invalid" });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!token || preview.status !== "ready") {
      setError("Invito non valido o scaduto");
      return;
    }

    const fd = new FormData(e.currentTarget);
    const password = String(fd.get("password") || "");
    const passwordConfirm = String(fd.get("passwordConfirm") || "");

    if (!password.trim()) {
      setError("Inserisci la password");
      return;
    }
    const complexityErr = validatePasswordComplexity(password);
    if (complexityErr) {
      setError(complexityErr);
      return;
    }
    if (!passwordConfirm.trim()) {
      setError("Conferma la password");
      return;
    }
    if (password !== passwordConfirm) {
      setError("Le password non coincidono");
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch("/api/auth/accept-invite", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ token, password, passwordConfirm }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          code?: string;
          ok?: boolean;
        };
        if (!res.ok || data.error) {
          if (data.code === "USER_EXISTS") {
            setError("Account già esistente per questo invito");
            return;
          }
          if (data.code === "PASSWORD_MISMATCH") {
            setError("Le password non coincidono");
            return;
          }
          if (data.code === "PASSWORD_WEAK") {
            setError(data.error || "Password non conforme");
            return;
          }
          setError("Invito non valido o scaduto");
          return;
        }
        setSuccess(
          "Account creato. L'azienda deve essere attivata prima di poter effettuare l'accesso."
        );
        window.setTimeout(() => {
          router.replace("/login");
          router.refresh();
        }, 1800);
      } catch {
        setError("Operazione non riuscita. Riprova tra qualche secondo.");
      }
    });
  }

  if (preview.status === "loading") {
    return <p className="text-sm text-[var(--muted)]">Verifica invito…</p>;
  }

  if (preview.status === "invalid") {
    return (
      <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
        Invito non valido o scaduto
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="block text-sm">
        Email
        <input
          type="email"
          value={preview.email}
          readOnly
          autoComplete="username"
          className={`${inputCls} bg-[#eef2f6] text-[var(--muted)]`}
        />
      </label>

      <p className="text-xs text-[var(--muted)]">{PASSWORD_REQUIREMENTS}</p>

      <label className="block text-sm">
        Password
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={6}
          disabled={pending || Boolean(success)}
          className={inputCls}
          placeholder="Maiuscola + carattere speciale"
        />
      </label>

      <label className="block text-sm">
        Conferma password
        <input
          name="passwordConfirm"
          type="password"
          autoComplete="new-password"
          required
          minLength={6}
          disabled={pending || Boolean(success)}
          className={inputCls}
          placeholder="Ripeti la password"
        />
      </label>

      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
      {success ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          {success}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending || Boolean(success)}
        className="h-11 w-full rounded-lg bg-[var(--navy)] text-white disabled:opacity-60"
      >
        {pending ? "Attivazione…" : "Attiva account"}
      </button>
    </form>
  );
}
