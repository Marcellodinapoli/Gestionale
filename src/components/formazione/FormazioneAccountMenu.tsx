"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, GraduationCap } from "lucide-react";
import { getFormazioneMenuItems } from "@/components/formazione/FormazioneNav";

export function FormazioneAccountMenu({ canMonitor = false }: { canMonitor?: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const items = getFormazioneMenuItems(canMonitor);

  const active =
    pathname.startsWith("/formazione") ||
    items.some((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

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

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 min-w-[220px] overflow-hidden rounded-xl border border-[var(--line)] bg-white py-1 shadow-lg"
        >
          {items.map(({ href, label, icon: Icon }) => {
            const itemActive = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                role="menuitem"
                onClick={() => setOpen(false)}
                className={`flex items-center gap-2 px-3 py-2.5 text-sm ${
                  itemActive
                    ? "bg-[#e8eef4] font-semibold text-[#1a365d]"
                    : "text-[var(--navy)] hover:bg-[#fafbfc]"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0 opacity-70" />
                {label}
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
