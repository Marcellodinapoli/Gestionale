"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const payload = {
      tenantSlug: String(fd.get("tenantSlug") || ""),
      email: String(fd.get("email") || ""),
      password: String(fd.get("password") || ""),
    };
    startTransition(async () => {
      try {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify(payload),
        });
        let data: { error?: string; ok?: boolean; href?: string } = {};
        try {
          data = await res.json();
        } catch {
          setError("Risposta non valida dal server. Controlla la configurazione Netlify.");
          return;
        }
        if (!res.ok || data.error) {
          setError(data.error || "Credenziali non valide");
          return;
        }
        if (data.ok && data.href) {
          router.push(data.href);
          router.refresh();
        }
      } catch {
        setError("Impossibile contattare il server. Riprova tra qualche secondo.");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="block text-sm">
        Codice azienda
        <input
          name="tenantSlug"
          type="text"
          required
          autoComplete="organization"
          className="mt-1 h-11 w-full rounded-lg border border-[var(--line)] px-3"
          placeholder="es. demo"
          defaultValue="demo"
        />
      </label>
      <label className="block text-sm">
        Email
        <input
          name="email"
          type="text"
          inputMode="email"
          autoComplete="username"
          required
          className="mt-1 h-11 w-full rounded-lg border border-[var(--line)] px-3"
          placeholder="es. admin@gestionale.local"
          defaultValue="admin@gestionale.local"
        />
      </label>
      <label className="block text-sm">
        Password
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="mt-1 h-11 w-full rounded-lg border border-[var(--line)] px-3"
          defaultValue="Demo123!"
        />
      </label>
      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="h-11 w-full rounded-lg bg-[var(--navy)] text-white disabled:opacity-60"
      >
        {pending ? "Accesso…" : "Entra"}
      </button>
    </form>
  );
}
