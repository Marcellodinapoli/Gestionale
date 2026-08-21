"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { SMS_PREIMPOSTATI } from "@/lib/smsPreimpostati";

export function SmsPresetsMenu({
  numero,
  x,
  y,
  onPick,
  onClose,
}: {
  numero: string;
  x: number;
  y: number;
  onPick: (testo: string, titolo: string) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      const t = e.target;
      if (t instanceof Node && document.getElementById("sms-presets-menu")?.contains(t)) {
        return;
      }
      onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const left = Math.min(x, typeof window !== "undefined" ? window.innerWidth - 280 : x);
  const top = Math.min(y, typeof window !== "undefined" ? window.innerHeight - 280 : y);

  return createPortal(
    <div
      id="sms-presets-menu"
      className="fixed z-[90] w-64 overflow-hidden rounded border border-[var(--line)] bg-white shadow-xl"
      style={{ left, top }}
      role="menu"
    >
      <p className="border-b border-[var(--line)] bg-[#dce4ec] px-2 py-1 text-[10px] font-bold uppercase text-[#1a365d]">
        SMS a {numero}
      </p>
      <ul className="max-h-64 overflow-auto py-0.5">
        {SMS_PREIMPOSTATI.map((m) => (
          <li key={m.id}>
            <button
              type="button"
              role="menuitem"
              className="flex w-full flex-col items-start px-2 py-1.5 text-left hover:bg-[#eef4f8]"
              onClick={() => onPick(m.testo, m.titolo)}
            >
              <span className="text-xs font-semibold text-[var(--navy)]">{m.titolo}</span>
              <span className="line-clamp-2 text-[10px] leading-snug text-[var(--muted)]">
                {m.testo}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>,
    document.body
  );
}
