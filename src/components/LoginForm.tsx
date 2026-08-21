"use client";

import { useState } from "react";
import { loginAction } from "@/actions/core";

export function LoginForm() {
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(formData: FormData) {
    setError(null);
    const result = await loginAction(formData);
    if (result?.error) setError(result.error);
  }

  return (
    <form action={onSubmit} className="space-y-4">
      <label className="block text-sm">
        Codice azienda
        <input
          name="tenantSlug"
          type="text"
          required
          autoComplete="organization"
          className="mt-1 h-11 w-full rounded-lg border border-[var(--line)] px-3"
          defaultValue="demo"
          placeholder="es. demo"
        />
      </label>
      <label className="block text-sm">
        Email
        <input
          name="email"
          type="email"
          required
          className="mt-1 h-11 w-full rounded-lg border border-[var(--line)] px-3"
          defaultValue="admin@gestionale.local"
        />
      </label>
      <label className="block text-sm">
        Password
        <input
          name="password"
          type="password"
          required
          className="mt-1 h-11 w-full rounded-lg border border-[var(--line)] px-3"
          defaultValue="Demo123!"
        />
      </label>
      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
      <button className="h-11 w-full rounded-lg bg-[var(--navy)] text-white">
        Entra
      </button>
    </form>
  );
}
