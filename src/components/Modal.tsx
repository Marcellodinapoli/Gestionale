"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

export function Modal({
  open,
  title,
  onClose,
  children,
  wide,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-lg border border-[var(--line)] bg-white shadow-2xl ${
          wide ? "max-w-5xl" : "max-w-lg"
        }`}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--line)] bg-[#dce4ec] px-4 py-2.5">
          <h2 className="text-sm font-bold text-[var(--navy)]">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-[var(--line)] bg-white p-1 text-[var(--muted)] hover:bg-[#eef4f8]"
            title="Chiudi (Esc)"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">{children}</div>
      </div>
    </div>,
    document.body
  );
}
