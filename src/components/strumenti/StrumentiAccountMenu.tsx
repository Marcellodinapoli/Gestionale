"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Wrench } from "lucide-react";
import { STRUMENTI_MENU_ITEMS } from "@/components/strumenti/StrumentiNav";

export function StrumentiAccountMenu() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const active =
    pathname.startsWith("/strumenti") ||
    STRUMENTI_MENU_ITEMS.some((item) => pathname.startsWith(item.href));

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
        <Wrench className="h-4 w-4 shrink-0" />
        Strumenti AI
        <ChevronDown
          className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 min-w-[260px] overflow-hidden rounded-xl border border-[var(--line)] bg-white py-1 shadow-lg"
        >
          {STRUMENTI_MENU_ITEMS.map(({ href, label, icon: Icon }) => {
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
