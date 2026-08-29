"use client";

import type { ReactNode } from "react";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
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
  Menu,
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
  MessageSquare,
  ArrowLeft,
  ClipboardList,
  GraduationCap,
  Wrench,
  MapPin,
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
import { ROLE_LABELS, can, canManageSedi, isFormazioneOnly, type SessionUser } from "@/lib/permissions";
import { resolveAffidiBackNav } from "@/lib/affidiNavBack";

const PRATICHE_BACK_KEY = "credixa:pratiche-back";

function isPratichePath(pathname: string) {
  return pathname === "/pratiche" || pathname.startsWith("/pratiche/");
}

function sectionLabelFromHref(href: string) {
  try {
    const path = href.startsWith("http") ? new URL(href).pathname : href.split("?")[0] || "/";
    if (path === "/") return "Home";
    const hit = [...MAIN_LINKS, ...ADMIN_LINKS].find(
      (l) => path === l.href || path.startsWith(`${l.href}/`)
    );
    return hit?.label || "pagina precedente";
  } catch {
    return "pagina precedente";
  }
}

type NavLink = {
  href: string;
  label: string;
  icon: LucideIcon;
  show: (u: SessionUser) => boolean;
};

const MAIN_LINKS: NavLink[] = [
  { href: "/", label: "Home", icon: Home, show: (u) => !isFormazioneOnly(u) },
  {
    href: "/pratiche",
    label: "Pratiche",
    icon: Briefcase,
    show: (u) => !isFormazioneOnly(u),
  },
  {
    href: "/affidi",
    label: "Affidi",
    icon: Users,
    show: (u) => !isFormazioneOnly(u) && can(u, "pratiche:assign"),
  },
  {
    href: "/agenda",
    label: "Agenda",
    icon: CalendarDays,
    show: (u) => !isFormazioneOnly(u) && can(u, "agenda:view"),
  },
  {
    href: "/messaggi",
    label: "Messaggi",
    icon: MessageSquare,
    show: (u) => !isFormazioneOnly(u) && can(u, "agenda:view"),
  },
  {
    href: "/statistiche",
    label: "Statistiche",
    icon: PieChart,
    show: (u) => !isFormazioneOnly(u) && can(u, "statistiche:view"),
  },
  {
    href: "/provigioni",
    label: "Provvigioni",
    icon: Wallet,
    show: (u) => !isFormazioneOnly(u) && can(u, "provigioni:view"),
  },
  {
    href: "/report",
    label: "Registrazioni",
    icon: Headphones,
    show: (u) => !isFormazioneOnly(u) && can(u, "report:view"),
  },
  {
    href: "/rubrica",
    label: "Rubrica",
    icon: BookUser,
    show: (u) => !isFormazioneOnly(u),
  },
  {
    href: "/lavorazione",
    label: "Lavorazione",
    icon: ClipboardList,
    show: (u) => !isFormazioneOnly(u) && can(u, "lavorazione:view"),
  },
  { href: "/account", label: "Account", icon: UserCircle, show: () => true },
  { href: "/formazione/progressi", label: "Formazione", icon: GraduationCap, show: (u) => can(u, "formazione:view") },
  { href: "/strumenti/ricerca-normativa", label: "Strumenti AI", icon: Wrench, show: (u) => !isFormazioneOnly(u) && can(u, "formazione:view") },
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
    href: "/sedi",
    label: "Sedi",
    icon: MapPin,
    show: (u) => canManageSedi(u),
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
  forceLabel,
  backHref,
  backNavHref,
  backLabel,
}: {
  link: NavLink;
  pathname: string;
  compact?: boolean;
  forceLabel?: boolean;
  backHref?: string | null;
  backNavHref?: string;
  backLabel?: string;
}) {
  const Icon = link.icon;
  const active = navActive(pathname, link.href);
  const showBack = Boolean(backHref) && active && link.href === backNavHref;
  const href = showBack && backHref ? backHref : link.href;
  const title = showBack
    ? backLabel || `Torna a ${sectionLabelFromHref(backHref!)}`
    : link.label;
  const label = showBack
    ? backLabel || sectionLabelFromHref(backHref!)
    : link.label;
  const showLabel = forceLabel || compact;

  return (
    <Link
      href={href}
      className={`flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-sm transition-colors sm:gap-1.5 sm:px-2.5 ${
        active
          ? "bg-white font-semibold text-[#132033]"
          : "text-white/75 hover:bg-white/10 hover:text-white"
      }`}
      title={title}
    >
      {showBack ? (
        <ArrowLeft className="h-4 w-4 shrink-0 text-[var(--accent,#0e7490)]" aria-hidden />
      ) : (
        <Icon className="h-4 w-4 shrink-0" />
      )}
      {showLabel ? (
        <span className="whitespace-nowrap">{label}</span>
      ) : (
        <span className="hidden whitespace-nowrap lg:inline">{label}</span>
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

function NavDropdownMenu({
  links,
  pathname,
  label,
  icon: Icon,
}: {
  links: NavLink[];
  pathname: string;
  label: string;
  icon: LucideIcon;
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
              const ItemIcon = link.icon;
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
                  <ItemIcon className="h-4 w-4 shrink-0 opacity-70" />
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
        <Icon className="h-4 w-4 shrink-0" />
        <span className="hidden whitespace-nowrap lg:inline">{label}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {menu}
    </>
  );
}

const NAV_GAP = 2;
const OVERFLOW_MENU_LABEL = "Menu";
const OVERFLOW_MENU_BTN_WIDTH = 80;
const GESTIONE_BTN_WIDTH = 92;

function useLgNavLabels() {
  const [lg, setLg] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const sync = () => setLg(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return lg;
}

function ResponsiveMainNav({
  links,
  pathname,
  praticheBackHref,
  affidiBackHref,
  affidiBackLabel,
  adminLinks,
}: {
  links: NavLink[];
  pathname: string;
  praticheBackHref: string | null;
  affidiBackHref: string | null;
  affidiBackLabel?: string;
  adminLinks: NavLink[];
}) {
  const navRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(links.length);
  const [mergedOverflowMenu, setMergedOverflowMenu] = useState(false);
  const lgLabels = useLgNavLabels();

  const recalculate = useCallback(() => {
    const navEl = navRef.current;
    const measureEl = measureRef.current;
    if (!navEl || !measureEl || !links.length) return;

    const widths = Array.from(measureEl.children).map(
      (el) => (el as HTMLElement).offsetWidth
    );
    if (widths.some((w) => w <= 0)) return;
    const available = navEl.clientWidth;
    const totalMain =
      widths.reduce((sum, w) => sum + w, 0) + Math.max(0, widths.length - 1) * NAV_GAP;

    const adminReserve = adminLinks.length ? GESTIONE_BTN_WIDTH : 0;
    if (totalMain <= available - adminReserve) {
      setVisibleCount(links.length);
      setMergedOverflowMenu(false);
      return;
    }

    let budget = available - OVERFLOW_MENU_BTN_WIDTH;
    let count = 0;
    for (let i = 0; i < widths.length; i++) {
      const need = widths[i] + (i > 0 ? NAV_GAP : 0);
      if (need > budget) break;
      budget -= need;
      count++;
    }
    setVisibleCount(Math.max(1, count));
    setMergedOverflowMenu(true);
  }, [links, adminLinks.length]);

  useEffect(() => {
    recalculate();
    const id = requestAnimationFrame(() => recalculate());
    return () => cancelAnimationFrame(id);
  }, [recalculate, pathname, lgLabels]);

  useEffect(() => {
    const navEl = navRef.current;
    if (!navEl) return;
    const ro = new ResizeObserver(() => recalculate());
    ro.observe(navEl);
    window.addEventListener("resize", recalculate);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", recalculate);
    };
  }, [recalculate]);

  const visibleLinks = links.slice(0, visibleCount);
  const overflowLinks = links.slice(visibleCount);
  const mergedMenuLinks = mergedOverflowMenu
    ? [...overflowLinks, ...adminLinks]
    : [];

  const navBackProps = (link: NavLink) => {
    if (link.href === "/pratiche") {
      return { backHref: praticheBackHref, backNavHref: "/pratiche" as const, backLabel: undefined };
    }
    if (link.href === "/affidi") {
      return {
        backHref: affidiBackHref,
        backNavHref: "/affidi" as const,
        backLabel: affidiBackLabel,
      };
    }
    return { backHref: null as string | null, backNavHref: undefined, backLabel: undefined };
  };

  return (
    <>
      <div
        ref={measureRef}
        aria-hidden
        className="pointer-events-none invisible absolute left-0 top-0 -z-10 flex gap-0.5"
      >
        {links.map((link) => (
          <NavItem
            key={link.href}
            link={link}
            pathname={pathname}
            forceLabel={lgLabels}
            {...navBackProps(link)}
          />
        ))}
      </div>
      <div
        ref={navRef}
        className="flex min-w-0 flex-1 flex-nowrap items-center gap-0.5"
      >
        {visibleLinks.map((link) => (
          <NavItem
            key={link.href}
            link={link}
            pathname={pathname}
            {...navBackProps(link)}
          />
        ))}
        {mergedOverflowMenu && mergedMenuLinks.length > 0 ? (
          <NavDropdownMenu
            links={mergedMenuLinks}
            pathname={pathname}
            label={OVERFLOW_MENU_LABEL}
            icon={Menu}
          />
        ) : adminLinks.length > 0 ? (
          <NavDropdownMenu
            links={adminLinks}
            pathname={pathname}
            label="Gestione"
            icon={Shield}
          />
        ) : null}
      </div>
    </>
  );
}

function AffidiBackSync({
  onChange,
}: {
  onChange: (href: string | null, label?: string) => void;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (pathname !== "/affidi") {
      onChange(null, undefined);
      return;
    }
    const back = resolveAffidiBackNav(searchParams.toString());
    onChange(back?.href ?? null, back?.label);
  }, [pathname, searchParams, onChange]);

  return null;
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
  const [praticheBackHref, setPraticheBackHref] = useState<string | null>(null);
  const [affidiBackHref, setAffidiBackHref] = useState<string | null>(null);
  const [affidiBackLabel, setAffidiBackLabel] = useState<string | undefined>();

  const onAffidiBackChange = useCallback((href: string | null, label?: string) => {
    setAffidiBackHref(href);
    setAffidiBackLabel(label);
  }, []);

  useEffect(() => {
    setEmbedded(window.self !== window.top);
  }, []);

  // ← in nav Pratiche solo nelle sottopagine (/pratiche/[id]/…), non sulla lista.
  useEffect(() => {
    const qs = window.location.search.replace(/^\?/, "");
    const full = qs ? `${pathname}?${qs}` : pathname;
    const isPraticheLista = pathname === "/pratiche";
    const isPraticheSottopagina =
      pathname.startsWith("/pratiche/") && pathname !== "/pratiche";

    if (isPraticheSottopagina) {
      try {
        const saved = sessionStorage.getItem(PRATICHE_BACK_KEY);
        const savedPath = saved?.split("?")[0] || "";
        setPraticheBackHref(saved && !isPratichePath(savedPath) ? saved : "/pratiche");
      } catch {
        setPraticheBackHref("/pratiche");
      }
    } else if (isPraticheLista) {
      setPraticheBackHref(null);
    } else {
      setPraticheBackHref(null);
      try {
        sessionStorage.setItem(PRATICHE_BACK_KEY, full);
      } catch {
        /* ignore */
      }
    }
  }, [pathname]);

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
    <Suspense fallback={null}>
      <AffidiBackSync onChange={onAffidiBackChange} />
    </Suspense>
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

          <nav className="relative order-3 flex min-w-0 flex-nowrap items-center pb-0.5 xl:order-2 xl:flex-1 xl:pb-0">
            <ResponsiveMainNav
              links={mainLinks}
              pathname={pathname}
              praticheBackHref={praticheBackHref}
              affidiBackHref={affidiBackHref}
              affidiBackLabel={affidiBackLabel}
              adminLinks={adminLinks}
            />
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
