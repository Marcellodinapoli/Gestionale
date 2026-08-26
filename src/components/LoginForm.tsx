"use client";

import { useState, useTransition } from "react";
import { loginAction } from "@/actions/core";

export function LoginForm() {
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
        const result = await loginAction(payload);
        if (result?.error) setError(result.error);
      } catch {
        // redirect() di Next lancia: login riuscito
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
          placeholder="es. supervisor.test@gestionale.local"
          defaultValue="supervisor.test@gestionale.local"
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
