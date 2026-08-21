"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  Briefcase,
  Building2,
  CalendarDays,
  ChevronDown,
  FileSpreadsheet,
  Headphones,
  Home,
  LogOut,
  Phone,
  ScrollText,
  Shield,
  Users,
  Wallet,
  PieChart,
  UserCog,
  Settings,
  Monitor,
  BookUser,
  UserCircle,
} from "lucide-react";
import { logoutAction } from "@/actions/core";
import { MemoPopupWatcher } from "@/components/agenda/MemoPopupWatcher";
import {
  PrivacyLockButton,
  PrivacyLockProvider,
} from "@/components/PrivacyLock";
import {
  PraticaHeaderSlotDisplay,
  PraticaHeaderSlotProvider,
} from "@/components/layout/PraticaHeaderSlot";
import { ROLE_LABELS, can, type SessionUser } from "@/lib/permissions";

type NavLink = {
  href: string;
  label: string;
  icon: LucideIcon;
  show: (u: SessionUser) => boolean;
};

const MAIN_LINKS: NavLink[] = [
  { href: "/", label: "Home", icon: Home, show: () => true },
  { href: "/pratiche", label: "Pratiche", icon: Briefcase, show: () => true },
  {
    href: "/affidi",
    label: "Affidi",
    icon: Users,
    show: (u) => can(u, "pratiche:assign"),
  },
  {
    href: "/agenda",
    label: "Agenda",
    icon: CalendarDays,
    show: (u) => can(u, "agenda:view"),
  },
  {
    href: "/statistiche",
    label: "Statistiche",
    icon: PieChart,
    show: (u) => can(u, "statistiche:view"),
  },
  {
    href: "/provigioni",
    label: "Provigioni",
    icon: Wallet,
    show: (u) => can(u, "provigioni:view"),
  },
  { href: "/rubrica", label: "Rubrica", icon: BookUser, show: () => true },
  { href: "/account", label: "Account", icon: UserCircle, show: () => true },
];

const ADMIN_LINKS: NavLink[] = [
  {
    href: "/import",
    label: "Import",
    icon: FileSpreadsheet,
    show: (u) => can(u, "import:run"),
  },
  {
    href: "/mandanti",
    label: "Mandanti",
    icon: Building2,
    show: (u) => can(u, "mandanti:manage"),
  },
  {
    href: "/report",
    label: "Registrazioni",
    icon: Headphones,
    show: (u) => can(u, "report:view"),
  },
  {
    href: "/telefonia",
    label: "Telefonia",
    icon: Phone,
    show: (u) => can(u, "telephony:manage"),
  },
  {
    href: "/operatori",
    label: "Operatori",
    icon: UserCog,
    show: (u) => can(u, "operatori:manage"),
  },
  {
    href: "/postazioni",
    label: "Postazioni",
    icon: Monitor,
    show: (u) => can(u, "operatori:manage"),
  },
  {
    href: "/configurazione",
    label: "Configurazione",
    icon: Settings,
    show: (u) => can(u, "users:manage"),
  },
  {
    href: "/log",
    label: "Log audit",
    icon: ScrollText,
    show: (u) => can(u, "audit:view"),
  },
];

function navActive(pathname: string, href: string) {
  return href === "/"
    ? pathname === "/"
    : pathname === href || pathname.startsWith(`${href}/`);
}

function NavItem({
  link,
  pathname,
  compact,
}: {
  link: NavLink;
  pathname: string;
  compact?: boolean;
}) {
  const Icon = link.icon;
  const active = navActive(pathname, link.href);
  return (
    <Link
      href={link.href}
      className={`flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-sm transition-colors sm:gap-1.5 sm:px-2.5 ${
        active
          ? "bg-white font-semibold text-[#132033]"
          : "text-white/75 hover:bg-white/10 hover:text-white"
      }`}
      title={link.label}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {!compact ? (
        <span className="hidden whitespace-nowrap lg:inline">{link.label}</span>
      ) : (
        <span className="whitespace-nowrap">{link.label}</span>
      )}
    </Link>
  );
}

function HeaderUserActions({
  user,
  roleLabel,
  ruoloVisibile,
  compact,
}: {
  user: SessionUser;
  roleLabel: string;
  ruoloVisibile: boolean;
  compact?: boolean;
}) {
  return (
    <>
      <Link
        href="/account"
        className={`font-medium hover:text-white ${
          compact ? "max-w-[9rem] truncate" : "max-w-[14rem] truncate xl:max-w-none xl:whitespace-nowrap"
        }`}
        title={[user.tenantNome, user.name, ruoloVisibile ? roleLabel : null]
          .filter(Boolean)
          .join(" · ")}
      >
        {compact ? (
          user.name
        ) : (
          <>
            {user.tenantNome ? (
              <span className="font-normal text-white/55">{user.tenantNome} · </span>
            ) : null}
            {user.name}
            {ruoloVisibile ? (
              <span className="font-normal text-white/55"> · {roleLabel}</span>
            ) : null}
            {user.interno ? (
              <span className="hidden font-normal text-white/55 2xl:inline">
                {" "}
                · int. {user.interno}
              </span>
            ) : null}
            {user.postazioneEmail ? (
              <span className="hidden font-normal text-white/55 2xl:inline">
                {" "}
                · {user.postazioneEmail}
              </span>
            ) : null}
          </>
        )}
      </Link>
      <PraticaHeaderSlotDisplay />
      <PrivacyLockButton />
      <form action={logoutAction}>
        <button
          type="submit"
          className="flex items-center gap-1 rounded-lg border border-white/20 px-2 py-1 text-white/75 hover:bg-white/10 hover:text-white"
          title="Esci"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Esci</span>
        </button>
      </form>
    </>
  );
}

function AdminNavMenu({
  links,
  pathname,
}: {
  links: NavLink[];
  pathname: string;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const active = links.some((l) => navActive(pathname, l.href));

  useEffect(() => setMounted(true), []);

  const updateMenuPos = useCallback(() => {
    const btn = buttonRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    setMenuPos({ top: rect.bottom + 4, left: rect.left });
  }, []);

  useEffect(() => {
    if (!open) return;
    updateMenuPos();
    window.addEventListener("resize", updateMenuPos);
    window.addEventListener("scroll", updateMenuPos, true);
    return () => {
      window.removeEventListener("resize", updateMenuPos);
      window.removeEventListener("scroll", updateMenuPos, true);
    };
  }, [open, updateMenuPos]);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      const target = e.target as Node;
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const menu =
    open && mounted
      ? createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{ top: menuPos.top, left: menuPos.left }}
            className="fixed z-[200] min-w-[12.5rem] rounded-lg border border-[var(--line)] bg-white py-1 shadow-lg"
          >
            {links.map((link) => {
              const Icon = link.icon;
              const itemActive = navActive(pathname, link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-2 px-3 py-2 text-sm ${
                    itemActive
                      ? "bg-slate-100 font-semibold text-[#132033]"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0 opacity-70" />
                  {link.label}
                </Link>
              );
            })}
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          if (!open) updateMenuPos();
        }}
        aria-expanded={open}
        aria-haspopup="menu"
        className={`flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-sm transition-colors sm:gap-1.5 sm:px-2.5 ${
          active || open
            ? "bg-white font-semibold text-[#132033]"
            : "text-white/75 hover:bg-white/10 hover:text-white"
        }`}
      >
        <Shield className="h-4 w-4 shrink-0" />
        <span className="hidden whitespace-nowrap lg:inline">Gestione</span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {menu}
    </>
  );
}

export function AppShell({
  user,
  children,
}: {
  user: SessionUser;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [embedded, setEmbedded] = useState(false);

  useEffect(() => {
    setEmbedded(window.self !== window.top);
  }, []);

  if (embedded) {
    return (
      <main className="flex h-dvh min-h-0 flex-col overflow-hidden bg-[var(--bg)] px-[1cm] py-2">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
      </main>
    );
  }

  const mainLinks = MAIN_LINKS.filter((l) => l.show(user));
  const adminLinks = ADMIN_LINKS.filter((l) => l.show(user));
  const roleLabel = ROLE_LABELS[user.role] || user.role;
  const ruoloVisibile = !user.name.toLowerCase().includes(roleLabel.toLowerCase());

  return (
    <PraticaHeaderSlotProvider>
    <PrivacyLockProvider userName={user.name}>
    <div className="flex h-dvh flex-col bg-[var(--bg)]">
      <header className="relative z-40 shrink-0 bg-[var(--navy)] text-white shadow-md print:hidden">
        <div className="flex flex-col gap-1.5 px-[1cm] py-1.5 xl:flex-row xl:items-center xl:gap-x-3">
          <div className="flex min-w-0 items-center justify-between gap-2 xl:order-1 xl:shrink-0">
            <p className="truncate text-sm font-semibold tracking-tight" title="Credixa">
              Credixa
            </p>
            <div className="flex shrink-0 items-center gap-1.5 text-xs xl:hidden">
              <HeaderUserActions
                user={user}
                roleLabel={roleLabel}
                ruoloVisibile={ruoloVisibile}
                compact
              />
            </div>
          </div>

          <nav className="order-3 flex min-w-0 flex-nowrap items-center gap-0.5 overflow-x-auto pb-0.5 [scrollbar-width:none] xl:order-2 xl:flex-1 xl:pb-0 [&::-webkit-scrollbar]:hidden">
            {mainLinks.map((link) => (
              <NavItem key={link.href} link={link} pathname={pathname} />
            ))}
            {adminLinks.length > 0 ? (
              <AdminNavMenu links={adminLinks} pathname={pathname} />
            ) : null}
          </nav>

          <div className="order-2 hidden shrink-0 items-center gap-2 text-xs xl:order-3 xl:flex">
            <HeaderUserActions
              user={user}
              roleLabel={roleLabel}
              ruoloVisibile={ruoloVisibile}
            />
          </div>
        </div>
      </header>

      {user.role === "MANUTENZIONE" ? (
        <p className="bg-[#3d4f63] px-[1cm] py-1 text-center text-[11px] text-white/80 print:hidden">
          Account manutenzione: tutte le schermate sono visibili, i dati operativi sono nascosti
        </p>
      ) : null}

      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden px-[1cm] py-2 print:h-auto print:overflow-visible print:p-0">
        <div className="h-full min-h-0 flex-1 overflow-y-auto print:h-auto print:overflow-visible">{children}</div>
        <MemoPopupWatcher userName={user.name} />
      </main>
    </div>
    </PrivacyLockProvider>
    </PraticaHeaderSlotProvider>
  );
}
