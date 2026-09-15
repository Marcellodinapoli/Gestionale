"use client";

import { useMemo, useState, useTransition } from "react";
import { ROLE_LABELS, type Role } from "@/lib/permissions";
import {
  NAV_PAGES,
  NAV_VISIBILITY_ROLES,
  type NavPageId,
  type NavRoleDefaults,
  type NavVisibilityMap,
} from "@/lib/navVisibility/catalog";
import { saveNavRoleDefaultsAction } from "@/actions/navVisibility";

export function NavVisibilityRoleMatrix({
  initialDefaults,
  initialRole = "OPERATOR",
}: {
  initialDefaults: NavRoleDefaults;
  initialRole?: Role;
}) {
  const [defaults, setDefaults] = useState<NavRoleDefaults>(initialDefaults);
  const [role, setRole] = useState<Role>(
    NAV_VISIBILITY_ROLES.includes(initialRole) ? initialRole : "OPERATOR"
  );
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const pages = useMemo(
    () => NAV_PAGES.filter((p) => !p.locked),
    []
  );

  const map = defaults[role] || {};

  function toggle(pageId: NavPageId, checked: boolean) {
    setDefaults((prev) => ({
      ...prev,
      [role]: { ...(prev[role] || {}), [pageId]: checked, account: true },
    }));
  }

  function selectAll(checked: boolean) {
    const next: NavVisibilityMap = { account: true };
    for (const p of pages) next[p.id] = checked;
    setDefaults((prev) => ({ ...prev, [role]: next }));
  }

  function onSave() {
    setMsg(null);
    setErr(null);
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("payload", JSON.stringify(defaults));
        await saveNavRoleDefaultsAction(fd);
        setMsg("Preferenze ruolo salvate.");
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Errore salvataggio");
      }
    });
  }

  return (
    <div className="space-y-4 rounded-xl border border-[var(--line)] bg-white p-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="mb-1 block text-[10px] font-semibold uppercase text-[var(--muted)]">
            Tipo account
          </span>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            className="h-9 rounded-lg border border-[var(--line)] px-3 text-sm"
          >
            {NAV_VISIBILITY_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="h-9 rounded-lg border border-[var(--line)] px-3 text-xs"
          onClick={() => selectAll(true)}
        >
          Seleziona tutte
        </button>
        <button
          type="button"
          className="h-9 rounded-lg border border-[var(--line)] px-3 text-xs"
          onClick={() => selectAll(false)}
        >
          Deseleziona tutte
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={onSave}
          className="h-9 rounded-lg bg-[var(--navy)] px-4 text-sm font-semibold text-white disabled:opacity-60"
        >
          {pending ? "Salvataggio…" : "Salva default ruolo"}
        </button>
      </div>

      <p className="text-xs text-[var(--muted)]">
        Flag = pagina visibile di default per tutti gli account{" "}
        <strong>{ROLE_LABELS[role]}</strong>.
      </p>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {pages.map((p) => (
          <label
            key={p.id}
            className="flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--line)] px-3 py-2 text-sm hover:bg-slate-50"
          >
            <input
              type="checkbox"
              checked={map[p.id] !== false}
              onChange={(e) => toggle(p.id, e.target.checked)}
              className="h-4 w-4"
            />
            <span>
              {p.label}
              <span className="ml-1 text-[10px] uppercase text-[var(--muted)]">
                {p.group}
              </span>
            </span>
          </label>
        ))}
      </div>

      {msg ? <p className="text-sm text-emerald-700">{msg}</p> : null}
      {err ? <p className="text-sm text-red-600">{err}</p> : null}
    </div>
  );
}
