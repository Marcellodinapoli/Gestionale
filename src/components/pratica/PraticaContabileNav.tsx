"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

const TABS = [
  { key: "fatture", label: "Fatture insolute", f: "F6" },
  { key: "estratto", label: "Estratto conto", f: "F7" },
  { key: "incassi", label: "Incassi registrati", f: "F8" },
] as const;

export function PraticaContabileNav({
  praticaId,
  attivo,
  compact,
  enableKeys,
}: {
  praticaId: string;
  attivo?: "fatture" | "estratto" | "incassi";
  compact?: boolean;
  enableKeys?: boolean;
}) {
  const router = useRouter();

  useEffect(() => {
    if (enableKeys === false) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && attivo) {
        e.preventDefault();
        router.push(`/pratiche/${praticaId}`);
        return;
      }
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) {
        return;
      }
      if (e.key === "F6") {
        e.preventDefault();
        router.push(`/pratiche/${praticaId}/fatture`);
      }
      if (e.key === "F7") {
        e.preventDefault();
        router.push(`/pratiche/${praticaId}/estratto`);
      }
      if (e.key === "F8") {
        e.preventDefault();
        router.push(`/pratiche/${praticaId}/incassi`);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [praticaId, router, enableKeys, attivo]);

  return (
    <div className={`flex flex-wrap gap-1 ${compact ? "" : "mb-3"}`}>
      {TABS.map((t) => {
        const href = `/pratiche/${praticaId}/${t.key}`;
        const on = attivo === t.key;
        return (
          <Link
            key={t.key}
            href={href}
            className={
              compact
                ? `rounded border px-2 py-1 text-[11px] ${
                    on
                      ? "border-[#132033] bg-[#132033] text-white"
                      : "border-[#808080] bg-gradient-to-b from-[#f0f0f0] to-[#d4d4d4] text-[#132033] hover:from-[#fafafa]"
                  }`
                : `rounded border px-3 py-1.5 text-xs font-medium ${
                    on
                      ? "border-[#132033] bg-[#132033] text-white"
                      : "border-[var(--line)] bg-white text-[#132033] hover:bg-[#eef4f8]"
                  }`
            }
          >
            {t.f} {t.label}
          </Link>
        );
      })}
      {attivo ? (
        <Link
          href={`/pratiche/${praticaId}`}
          className="rounded border border-[var(--line)] bg-white px-3 py-1.5 text-xs text-[var(--muted)] hover:bg-[#eef4f8]"
        >
          Esc Anagrafica
        </Link>
      ) : null}
    </div>
  );
}
