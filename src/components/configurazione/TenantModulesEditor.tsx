"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Layers } from "lucide-react";
import { salvaModuliPiattaformaAction } from "@/actions/configurazione";
import {
  FUTURE_MODULE_IDS,
  MODULE_CATALOG,
  SELLABLE_MODULE_IDS,
  type ModuleId,
} from "@/lib/platform/modules";

type Props = {
  enabledModules: ModuleId[];
};

export function TenantModulesEditor({ enabledModules }: Props) {
  const router = useRouter();
  const [on, setOn] = useState<Set<ModuleId>>(
    () => new Set(enabledModules.length ? enabledModules : [])
  );
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function toggle(id: ModuleId) {
    setOn((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      next.add("core");
      return next;
    });
  }

  async function salva() {
    setSaving(true);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.set("modules", JSON.stringify(["core", ...SELLABLE_MODULE_IDS.filter((id) => on.has(id))]));
      await salvaModuliPiattaformaAction(fd);
      setMsg("Salvato");
      router.refresh();
      setTimeout(() => setMsg(null), 3000);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Errore");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-white">
      <div className="flex items-center gap-3 bg-[#c5d4e3] px-4 py-2.5">
        <Layers className="h-5 w-5 text-[#1a365d]" />
        <div>
          <h2 className="text-sm font-bold text-[#1a365d]">Moduli di questa azienda</h2>
          <p className="text-[10px] text-[#1a365d]/70">
            Accendi solo le sezioni vendute a questo tenant. Menu e pagine restano bloccati se il
            modulo è spento.
          </p>
        </div>
      </div>
      <div className="grid gap-2 p-4 sm:grid-cols-2">
        {MODULE_CATALOG.filter((m) => m.locked).map((m) => (
          <label
            key={m.id}
            className="flex cursor-not-allowed items-start gap-3 rounded-lg border border-[var(--line)] bg-slate-50 px-3 py-2 opacity-80"
          >
            <input type="checkbox" checked readOnly className="mt-1" />
            <span>
              <span className="block text-sm font-semibold">{m.label}</span>
              <span className="block text-[11px] text-[var(--muted)]">{m.description}</span>
            </span>
          </label>
        ))}
        {MODULE_CATALOG.filter((m) => SELLABLE_MODULE_IDS.includes(m.id)).map((m) => (
          <label
            key={m.id}
            className="flex cursor-pointer items-start gap-3 rounded-lg border border-[var(--line)] px-3 py-2 hover:bg-slate-50"
          >
            <input
              type="checkbox"
              className="mt-1"
              checked={on.has(m.id)}
              onChange={() => toggle(m.id)}
            />
            <span>
              <span className="block text-sm font-semibold">{m.label}</span>
              <span className="block text-[11px] text-[var(--muted)]">{m.description}</span>
            </span>
          </label>
        ))}
        {MODULE_CATALOG.filter((m) =>
          (FUTURE_MODULE_IDS as readonly string[]).includes(m.id)
        ).map((m) => (
          <label
            key={m.id}
            className="flex cursor-not-allowed items-start gap-3 rounded-lg border border-dashed border-[var(--line)] px-3 py-2 opacity-60"
          >
            <input type="checkbox" disabled className="mt-1" />
            <span>
              <span className="block text-sm font-semibold">{m.label} — in arrivo</span>
              <span className="block text-[11px] text-[var(--muted)]">{m.description}</span>
            </span>
          </label>
        ))}
      </div>
      <div className="flex items-center gap-3 border-t border-[var(--line)] px-4 py-3">
        <button
          type="button"
          onClick={salva}
          disabled={saving}
          className="h-9 rounded-lg bg-[var(--navy)] px-5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Salvataggio..." : "Salva moduli"}
        </button>
        {msg ? (
          <span
            className={`text-xs font-semibold ${
              msg === "Salvato" ? "text-emerald-600" : "text-amber-600"
            }`}
          >
            {msg}
          </span>
        ) : null}
      </div>
    </div>
  );
}
