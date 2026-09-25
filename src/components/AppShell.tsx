"use client";

import type { ReactNode } from "react";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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
  PhoneForwarded,
  ScrollText,
  Shield,
  Users,
  Wallet,
  PieChart,
  UserCog,
  Settings,
  Monitor,
  BookUser,
  Banknote,
  UserCircle,
  Calculator,
  MessageSquare,
  ArrowLeft,
  ClipboardList,
  GraduationCap,
  Wrench,
  MapPin,
  Scale,
  Layers,
} from "lucide-react";
import { logoutAction } from "@/actions/core";
import { MemoPopupWatcher } from "@/components/agenda/MemoPopupWatcher";
import { PreavvisoStragiudizialeWatcher } from "@/components/agenda/PreavvisoStragiudizialeWatcher";
import {
  PrivacyLockButton,
  PrivacyLockProvider,
} from "@/components/PrivacyLock";
import {
  PraticaHeaderSlotDisplay,
  PraticaHeaderSlotProvider,
} from "@/components/layout/PraticaHeaderSlot";
import { ROLE_LABELS, can, canManageSedi, isFormazioneOnly, type SessionUser } from "@/lib/permissions";
import { hasModule, type ModuleId, type TenantPlatformConfig } from "@/lib/platform/modules";
import { resolveAffidiBackNav } from "@/lib/affidiNavBack";
import { navigateBack } from "@/lib/navBack";
import { labelForNavBackHref, navBackDisplayLabel } from "@/lib/navBackLabel";
import {
  PRATICHE_BACK_KEY,
} from "@/lib/praticheNavBack";

function isPratichePath(pathname: string) {
  return pathname === "/pratiche" || pathname.startsWith("/pratiche/");
}

type NavLink = {
  href: string;
  label: string;
  icon: LucideIcon;
  moduleId: ModuleId;
  show: (u: SessionUser) => boolean;
  /** Id catalogo visibilità pagine (se assente = sempre secondo show()). */
  navPageId?: import("@/lib/navVisibility/catalog").NavPageId;
  /** Icona in evidenza: badge + colore, senza tintare tutta la riga. */
  accent?: NavAccent;
};

type NavAccent = {
  iconDark: string;
  iconLight: string;
  badgeDark: string;
  badgeLight: string;
};

const NAV_ACCENT: Record<string, NavAccent> = {
  legal: {
    iconDark: "text-[#e8d5b5]",
    iconLight: "text-[#8a6a3d]",
    badgeDark: "bg-[#d4b896]/25 ring-1 ring-[#e8d5b5]/50",
    badgeLight: "bg-[#f4ead8] ring-1 ring-[#d4b896]/60",
  },
  formazione: {
    iconDark: "text-[#5eead4]",
    iconLight: "text-[#0f766e]",
    badgeDark: "bg-teal-400/25 ring-1 ring-teal-300/55",
    badgeLight: "bg-teal-50 ring-1 ring-teal-300/75",
  },
  recruiting: {
    iconDark: "text-[#7dd3fc]",
    iconLight: "text-[#1d4ed8]",
    badgeDark: "bg-sky-400/25 ring-1 ring-sky-300/55",
    badgeLight: "bg-sky-50 ring-1 ring-sky-300/75",
  },
  dialer: {
    iconDark: "text-[#fdba74]",
    iconLight: "text-[#c2410c]",
    badgeDark: "bg-orange-400/25 ring-1 ring-orange-300/55",
    badgeLight: "bg-orange-50 ring-1 ring-orange-300/75",
  },
  creditcalc: {
    iconDark: "text-[#c4b5fd]",
    iconLight: "text-[#6d28d9]",
    badgeDark: "bg-violet-400/25 ring-1 ring-violet-300/55",
    badgeLight: "bg-violet-50 ring-1 ring-violet-300/75",
  },
};

function NavAccentIcon({
  icon: Icon,
  accent,
  onLight,
}: {
  icon: LucideIcon;
  accent?: NavAccent;
  onLight?: boolean;
}) {
  if (!accent) {
    return <Icon className="h-4 w-4 shrink-0" />;
  }
  return (
    <span
      className={`inline-flex h-[1.375rem] w-[1.375rem] shrink-0 items-center justify-center rounded-md ${
        onLight ? accent.badgeLight : accent.badgeDark
      }`}
    >
      <Icon className={`h-3.5 w-3.5 ${onLight ? accent.iconLight : accent.iconDark}`} />
    </span>
  );
}

const MAIN_LINKS: NavLink[] = [
  { href: "/", label: "Home", icon: Home, moduleId: "core", navPageId: "home", show: (u) => !isFormazioneOnly(u) },
  {
    href: "/pratiche",
    label: "Pratiche",
    icon: Briefcase,
    moduleId: "recovery",
    navPageId: "pratiche",
    show: (u) => !isFormazioneOnly(u),
  },
  {
    href: "/incassi",
    label: "Incassi",
    icon: Banknote,
    moduleId: "incassi",
    navPageId: "incassi",
    show: (u) => !isFormazioneOnly(u) && can(u, "incassi:list"),
  },
  {
    href: "/affidi",
    label: "Affidi",
    icon: Users,
    moduleId: "affidi",
    navPageId: "affidi",
    show: (u) => !isFormazioneOnly(u) && can(u, "pratiche:assign"),
  },
  {
    href: "/agenda",
    label: "Agenda",
    icon: CalendarDays,
    moduleId: "core",
    navPageId: "agenda",
    show: (u) => !isFormazioneOnly(u) && can(u, "agenda:view"),
  },
  {
    href: "/messaggi",
    label: "Messaggi",
    icon: MessageSquare,
    moduleId: "core",
    navPageId: "messaggi",
    show: (u) => !isFormazioneOnly(u) && can(u, "agenda:view"),
  },
  {
    href: "/statistiche",
    label: "Statistiche",
    icon: PieChart,
    moduleId: "recovery",
    navPageId: "statistiche",
    show: (u) => !isFormazioneOnly(u) && can(u, "statistiche:view"),
  },
  {
    href: "/provigioni",
    label: "Provvigioni",
    icon: Wallet,
    moduleId: "recovery",
    navPageId: "provigioni",
    show: (u) => !isFormazioneOnly(u) && can(u, "provigioni:view"),
  },
  {
    href: "/report",
    label: "Registrazioni",
    icon: Headphones,
    moduleId: "recovery",
    navPageId: "report",
    show: (u) => !isFormazioneOnly(u) && can(u, "report:view"),
  },
  {
    href: "/rubrica",
    label: "Rubrica",
    icon: BookUser,
    moduleId: "core",
    navPageId: "rubrica",
    show: (u) => !isFormazioneOnly(u),
  },
  {
    href: "/lavorazione",
    label: "Lavorazione",
    icon: ClipboardList,
    moduleId: "lavorazione",
    navPageId: "lavorazione",
    show: (u) => !isFormazioneOnly(u) && can(u, "lavorazione:view"),
  },
  {
    href: "/predictive-dialer",
    label: "Dialer",
    icon: PhoneForwarded,
    moduleId: "dialer",
    navPageId: "dialer",
    show: (u) => !isFormazioneOnly(u) && can(u, "dialer:operate"),
    accent: NAV_ACCENT.dialer,
  },
  { href: "/account", label: "Account", icon: UserCircle, moduleId: "core", navPageId: "account", show: () => true },
  {
    href: "/creditcalc",
    label: "CreditCalc",
    icon: Calculator,
    moduleId: "core",
    navPageId: "creditcalc",
    show: () => true,
    accent: NAV_ACCENT.creditcalc,
  },
  {
    href: "/formazione/progressi",
    label: "Formazione",
    icon: GraduationCap,
    moduleId: "formazione",
    navPageId: "formazione",
    show: (u) => can(u, "formazione:view"),
    accent: NAV_ACCENT.formazione,
  },
  {
    href: "/strumenti/ricerca-normativa",
    label: "Strumenti AI",
    icon: Wrench,
    moduleId: "strumenti",
    navPageId: "strumenti",
    show: (u) => !isFormazioneOnly(u) && can(u, "strumenti:view"),
    accent: NAV_ACCENT.formazione,
  },
  {
    href: "/legal",
    label: "Legal",
    icon: Scale,
    moduleId: "legale",
    navPageId: "legal",
    show: (u) => !isFormazioneOnly(u) && can(u, "legal:view"),
    accent: NAV_ACCENT.legal,
  },
  {
    href: "/recruiting",
    label: "Recruiting",
    icon: Briefcase,
    moduleId: "recruiting",
    navPageId: "recruiting",
    show: (u) => !isFormazioneOnly(u) && can(u, "recruiting:view"),
    accent: NAV_ACCENT.recruiting,
  },
  {
    href: "/portafogli",
    label: "Portafogli",
    icon: Layers,
    moduleId: "utp-npl",
    navPageId: "portafogli",
    show: (u) => !isFormazioneOnly(u) && can(u, "portafogli:view"),
  },
];

const ADMIN_LINKS: NavLink[] = [
  {
    href: "/import",
    label: "Import",
    icon: FileSpreadsheet,
    moduleId: "recovery",
    navPageId: "import",
    show: (u) => can(u, "import:run"),
  },
  {
    href: "/mandanti",
    label: "Mandanti",
    icon: Building2,
    moduleId: "recovery",
    navPageId: "mandanti",
    show: (u) => can(u, "mandanti:manage"),
  },
  {
    href: "/telefonia",
    label: "Telefonia",
    icon: Phone,
    moduleId: "core",
    navPageId: "telefonia",
    show: (u) => can(u, "telephony:manage"),
  },
  {
    href: "/operatori",
    label: "Operatori",
    icon: UserCog,
    moduleId: "core",
    navPageId: "operatori",
    show: (u) => can(u, "operatori:manage"),
  },
  {
    href: "/sedi",
    label: "Sedi",
    icon: MapPin,
    moduleId: "core",
    navPageId: "sedi",
    show: (u) => canManageSedi(u),
  },
  {
    href: "/postazioni",
    label: "Postazioni",
    icon: Monitor,
    moduleId: "core",
    navPageId: "postazioni",
    show: (u) => can(u, "operatori:manage"),
  },
  {
    href: "/configurazione",
    label: "Configurazione",
    icon: Settings,
    moduleId: "core",
    navPageId: "configurazione",
    show: (u) => can(u, "users:manage"),
  },
  {
    href: "/log",
    label: "Log audit",
    icon: ScrollText,
    moduleId: "core",
    navPageId: "log",
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
  const router = useRouter();
  const Icon = link.icon;
  const active = navActive(pathname, link.href);
  const showBack = Boolean(backHref) && active && link.href === backNavHref;
  const backDisplayLabel = showBack
    ? navBackDisplayLabel(link.label, backHref!, backLabel)
    : link.label;
  const title = showBack ? `Torna a ${backDisplayLabel}` : link.label;
  const label = showBack ? backDisplayLabel : link.label;
  const showLabel = forceLabel || compact;
  const itemClass = `flex shrink-0 cursor-pointer items-center gap-1 rounded-lg px-2 py-1.5 text-sm transition-colors sm:gap-1.5 sm:px-2.5 ${
    active
      ? "bg-white font-semibold text-[#132033]"
      : "text-white/75 hover:bg-white/10 hover:text-white"
  }`;

  if (showBack) {
    return (
      <button
        type="button"
        onClick={() => navigateBack(router, backHref)}
        className={itemClass}
        title={title}
        aria-label={title}
      >
        <NavAccentIcon icon={ArrowLeft} accent={link.accent} onLight={active} />
        {showLabel ? (
          <span className="whitespace-nowrap">{label}</span>
        ) : (
          <span className="hidden whitespace-nowrap lg:inline">{label}</span>
        )}
      </button>
    );
  }

  return (
    <Link
      href={link.href}
      className={itemClass}
      title={title}
    >
      <NavAccentIcon icon={Icon} accent={link.accent} onLight={active} />
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
                  className={`mx-1 flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
                    itemActive
                      ? "bg-slate-100 font-semibold text-[#132033]"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <NavAccentIcon icon={ItemIcon} accent={link.accent} onLight />
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
/** Riserva per bottone Menu/Gestione nello stato attivo (bianco + semibold), più margine. */
const OVERFLOW_MENU_BTN_WIDTH = 118;
const GESTIONE_BTN_WIDTH = 118;
/** Path fittizio: misura le voci sempre “inactive” così il fit non cambia cambiando pagina. */
const NAV_MEASURE_PATH = "__nav_measure__";

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
  praticheBackLabel,
  affidiBackHref,
  affidiBackLabel,
  adminLinks,
}: {
  links: NavLink[];
  pathname: string;
  praticheBackHref: string | null;
  praticheBackLabel?: string;
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

  // Solo resize / label lg: NON ricalcolare al cambio pathname (evita Dialer che entra/esce dal Menu).
  useEffect(() => {
    recalculate();
    const id = requestAnimationFrame(() => recalculate());
    return () => cancelAnimationFrame(id);
  }, [recalculate, lgLabels]);

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
      return {
        backHref: praticheBackHref,
        backNavHref: "/pratiche" as const,
        backLabel: praticheBackLabel,
      };
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
            pathname={NAV_MEASURE_PATH}
            forceLabel={lgLabels}
          />
        ))}
      </div>
      <div
        ref={navRef}
        className="flex min-w-0 flex-1 flex-nowrap items-center gap-0.5 overflow-hidden"
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

/** Persiste / ripristina la destinazione ← Pratiche (filtri e ordine in query). */
function PraticheBackSync({
  onChange,
}: {
  onChange: (href: string | null, label?: string) => void;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const qs = searchParams.toString();
    const full = qs ? `${pathname}?${qs}` : pathname;
    const isPraticheLista = pathname === "/pratiche";
    const isPraticheSottopagina =
      pathname.startsWith("/pratiche/") && pathname !== "/pratiche";

    if (isPraticheLista) {
      onChange(null, undefined);
      try {
        // Così da una scheda ← torna alla lista (non a Home/altra pagina visitata prima).
        sessionStorage.setItem(PRATICHE_BACK_KEY, full);
      } catch {
        /* ignore */
      }
      return;
    }

    if (isPraticheSottopagina) {
      try {
        const saved = sessionStorage.getItem(PRATICHE_BACK_KEY);
        const savedPath = saved?.split("?")[0] || "";
        let href = "/pratiche";
        if (saved && savedPath === "/pratiche") {
          href = saved;
        } else if (saved && !isPratichePath(savedPath)) {
          // Provenienza esterna (es. Affidi): mantieni quella destinazione
          href = saved;
        }
        const label =
          href.split("?")[0] === "/pratiche"
            ? "Pratiche"
            : labelForNavBackHref(href);
        onChange(href, label);
      } catch {
        onChange("/pratiche", "Pratiche");
      }
      return;
    }

    onChange(null, undefined);
    try {
      sessionStorage.setItem(PRATICHE_BACK_KEY, full);
    } catch {
      /* ignore */
    }
  }, [pathname, searchParams, onChange]);

  return null;
}

export function AppShell({
  user,
  platform,
  navVisibility,
  children,
}: {
  user: SessionUser;
  /** Profilo moduli tenant; se omesso = default recovery (menu invariato). */
  platform?: Pick<TenantPlatformConfig, "enabledModules"> | null;
  /** Visibilità effettiva pagine (default ruolo + eccezioni utente). */
  navVisibility?: Partial<Record<import("@/lib/navVisibility/catalog").NavPageId, boolean>> | null;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [embedded, setEmbedded] = useState(false);
  const [praticheBackHref, setPraticheBackHref] = useState<string | null>(null);
  const [praticheBackLabel, setPraticheBackLabel] = useState<string | undefined>();
  const [affidiBackHref, setAffidiBackHref] = useState<string | null>(null);
  const [affidiBackLabel, setAffidiBackLabel] = useState<string | undefined>();

  const onAffidiBackChange = useCallback((href: string | null, label?: string) => {
    setAffidiBackHref(href);
    setAffidiBackLabel(label);
  }, []);

  const onPraticheBackChange = useCallback((href: string | null, label?: string) => {
    setPraticheBackHref(href);
    setPraticheBackLabel(label);
  }, []);

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

  const mainLinks = MAIN_LINKS.filter((l) => {
    if (!hasModule(platform?.enabledModules, l.moduleId)) return false;
    if (l.navPageId && navVisibility) return navVisibility[l.navPageId] !== false;
    return l.show(user);
  });
  const adminLinks = ADMIN_LINKS.filter((l) => {
    if (!hasModule(platform?.enabledModules, l.moduleId)) return false;
    if (l.navPageId && navVisibility) return navVisibility[l.navPageId] !== false;
    return l.show(user);
  });
  const roleLabel = ROLE_LABELS[user.role] || user.role;
  const ruoloVisibile = !user.name.toLowerCase().includes(roleLabel.toLowerCase());

  return (
    <PraticaHeaderSlotProvider>
    <PrivacyLockProvider userName={user.name}>
    <Suspense fallback={null}>
      <AffidiBackSync onChange={onAffidiBackChange} />
    </Suspense>
    <Suspense fallback={null}>
      <PraticheBackSync onChange={onPraticheBackChange} />
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
              praticheBackLabel={praticheBackLabel}
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
        <div className="h-full min-h-0 min-w-0 flex-1 overflow-y-auto print:h-auto print:overflow-visible">
          {children}
        </div>
        <MemoPopupWatcher userName={user.name} />
        <PreavvisoStragiudizialeWatcher />
      </main>
    </div>
    </PrivacyLockProvider>
    </PraticaHeaderSlotProvider>
  );
}
