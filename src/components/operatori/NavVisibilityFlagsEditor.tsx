"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  NAV_PAGES,
  type NavPageId,
  type NavVisibilityMap,
} from "@/lib/navVisibility/catalog";
import { ROLE_LABELS, type Role } from "@/lib/permissions";
import { saveNavSingleRoleDefaultsAction } from "@/actions/navVisibility";

/**
 * Checkbox pagine: default ruolo già flaggati; differenze = eccezioni utente.
 * Opzione extra: salvare i flag come default del tipo account.
 */
export function NavVisibilityFlagsEditor({
  roleDefaults,
  userOverrides,
  role,
  name = "navVisibilityJson",
  disabled,
  allowEditRoleDefaults = true,
}: {
  roleDefaults: NavVisibilityMap;
  userOverrides?: NavVisibilityMap | null;
  /** Ruolo dell’account (per default di tutti e link). */
  role?: Role;
  name?: string;
  disabled?: boolean;
  allowEditRoleDefaults?: boolean;
}) {
  const pages = useMemo(() => NAV_PAGES.filter((p) => !p.locked), []);

  const initial = useMemo(() => {
    const out: NavVisibilityMap = {};
    for (const p of pages) {
      const ovr = userOverrides?.[p.id];
      out[p.id] =
        typeof ovr === "boolean" ? ovr : roleDefaults[p.id] !== false;
    }
    out.account = true;
    return out;
  }, [pages, roleDefaults, userOverrides]);

  const [flags, setFlags] = useState<NavVisibilityMap>(initial);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setFlags(initial);
  }, [initial]);

  function toggle(pageId: NavPageId, checked: boolean) {
    setFlags((prev) => ({ ...prev, [pageId]: checked, account: true }));
  }

  const exceptionCount = pages.filter((p) => {
    const base = roleDefaults[p.id] !== false;
    const cur = flags[p.id] !== false;
    return base !== cur;
  }).length;

  const roleLabel = role ? ROLE_LABELS[role] || role : null;

  function saveAsRoleDefault() {
    if (!role) return;
    setMsg(null);
    setErr(null);
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("role", role);
        fd.set("payload", JSON.stringify(flags));
        await saveNavSingleRoleDefaultsAction(fd);
        setMsg(
          `Default aggiornato per tutti gli account ${roleLabel}. Vale anche per i nuovi.`
        );
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Errore salvataggio default ruolo");
      }
    });
  }

  return (
    <div className="space-y-2 rounded-lg border border-[var(--line)] bg-slate-50/80 p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
          Visibilità pagine (questo utente)
        </p>
        {exceptionCount > 0 ? (
          <p className="text-[11px] text-amber-800">
            {exceptionCount} eccezion{exceptionCount === 1 ? "e" : "i"} rispetto
            al default del ruolo
          </p>
        ) : (
          <p className="text-[11px] text-[var(--muted)]">
            Allineato al default del ruolo
          </p>
        )}
      </div>
      <p className="text-[11px] text-[var(--muted)]">
        I flag qui sotto valgono solo per questo account. Per cambiare il default
        di tutti i{roleLabel ? ` ${roleLabel}` : "lo stesso ruolo"} usa il pulsante
        sotto oppure{" "}
        {role ? (
          <Link
            href={`/configurazione/visibilita?ruolo=${encodeURIComponent(role)}`}
            className="font-medium text-[var(--navy)] underline"
            target="_blank"
          >
            Preferenze visibilità
          </Link>
        ) : (
          <Link
            href="/configurazione/visibilita"
            className="font-medium text-[var(--navy)] underline"
            target="_blank"
          >
            Preferenze visibilità
          </Link>
        )}
        .
      </p>
      <input type="hidden" name={name} value={JSON.stringify(flags)} />
      <div className="grid max-h-48 gap-1 overflow-y-auto sm:grid-cols-2">
        {pages.map((p) => {
          const base = roleDefaults[p.id] !== false;
          const checked = flags[p.id] !== false;
          const isException = base !== checked;
          return (
            <label
              key={p.id}
              className={`flex items-center gap-2 rounded px-2 py-1 text-xs ${
                isException ? "bg-amber-50" : ""
              } ${disabled ? "opacity-50" : "cursor-pointer"}`}
            >
              <input
                type="checkbox"
                checked={checked}
                disabled={disabled}
                onChange={(e) => toggle(p.id, e.target.checked)}
                className="h-3.5 w-3.5"
              />
              <span className="min-w-0 truncate">
                {p.label}
                {isException ? (
                  <span className="ml-1 text-[10px] text-amber-700">
                    (eccezione)
                  </span>
                ) : null}
              </span>
            </label>
          );
        })}
      </div>

      {allowEditRoleDefaults && role && roleLabel ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-[var(--line)] pt-2">
          <button
            type="button"
            disabled={disabled || pending}
            onClick={saveAsRoleDefault}
            className="h-8 rounded-lg border border-[var(--navy)] bg-white px-3 text-xs font-semibold text-[var(--navy)] hover:bg-slate-50 disabled:opacity-60"
          >
            {pending
              ? "Salvataggio default…"
              : `Salva come default per tutti i ${roleLabel}`}
          </button>
        </div>
      ) : null}
      {msg ? <p className="text-[11px] text-emerald-700">{msg}</p> : null}
      {err ? <p className="text-[11px] text-red-600">{err}</p> : null}
    </div>
  );
}
