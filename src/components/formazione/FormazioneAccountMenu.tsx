"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, GraduationCap } from "lucide-react";
import { getFormazioneMenuItems } from "@/components/formazione/FormazioneNav";

export function FormazioneAccountMenu({ canMonitor = false }: { canMonitor?: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; right: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const items = getFormazioneMenuItems(canMonitor);

  const active =
    pathname.startsWith("/formazione") ||
    items.some((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));

  function updateCoords() {
    const el = rootRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setCoords({
      top: rect.bottom + 8,
      right: Math.max(8, window.innerWidth - rect.right),
    });
  }

  useLayoutEffect(() => {
    if (!open) {
      setCoords(null);
      return;
    }
    updateCoords();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      const t = e.target as Node;
      if (rootRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onReposition() {
      updateCoords();
    }
    document.addEventListener("mousedown", onDocClick);
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open]);

  const menu =
    open && coords
      ? createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{ top: coords.top, right: coords.right }}
            className="fixed z-[200] w-80 rounded-xl border border-[var(--line)] bg-white py-2 shadow-xl"
          >
            {items.map(({ href, label, icon: Icon }) => {
              const itemActive = pathname === href || pathname.startsWith(`${href}/`);
              return (
                <Link
                  key={href}
                  href={href}
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 text-sm ${
                    itemActive
                      ? "bg-[#e8eef4] font-semibold text-[#1a365d]"
                      : "text-[var(--navy)] hover:bg-[#fafbfc]"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0 opacity-70" />
                  <span>{label}</span>
                </Link>
              );
            })}
          </div>,
          document.body
        )
      : null;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition ${
          active || open
            ? "border-white/40 bg-white/15 text-white"
            : "border-white/25 bg-white/10 text-white hover:bg-white/20"
        }`}
      >
        <GraduationCap className="h-4 w-4 shrink-0" />
        Formazione
        <ChevronDown
          className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {menu}
    </div>
  );
}
