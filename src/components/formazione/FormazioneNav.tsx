"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  CircleHelp,
  Headphones,
  LineChart,
  MessagesSquare,
  Users,
} from "lucide-react";
import { useFormazioneIntro } from "@/components/formazione/FormazioneIntro";
import { navigateBack } from "@/lib/navBack";

const BASE_ITEMS = [
  {
    href: "/formazione/progressi",
    label: "I miei progressi",
    icon: LineChart,
  },
  { href: "/formazione/corsi", label: "Corsi", icon: BookOpen },
  { href: "/formazione/warm-up", label: "Warm-up", icon: Headphones },
  { href: "/formazione/roleplay", label: "Role Play", icon: MessagesSquare },
] as const;

const COLLABORATORI_ITEM = {
  href: "/formazione/collaboratori",
  label: "Collaboratori",
  icon: Users,
} as const;

export function getFormazioneMenuItems(canMonitor = false) {
  return canMonitor ? [COLLABORATORI_ITEM, ...BASE_ITEMS] : [...BASE_ITEMS];
}

function isActive(pathname: string, href: string) {
  if (href === "/formazione/corsi") {
    return pathname === href || pathname.startsWith("/formazione/corsi/");
  }
  if (href === "/formazione/collaboratori") {
    return pathname === href || pathname.startsWith("/formazione/collaboratori/");
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function isCourseDetail(pathname: string) {
  return (
    pathname.startsWith("/formazione/corsi/") && pathname !== "/formazione/corsi"
  );
}

function collaboratorNavBack(pathname: string): string | null {
  if (!pathname.startsWith("/formazione/collaboratori/")) return null;
  if (pathname === "/formazione/collaboratori") return null;

  const match = pathname.match(/^\/formazione\/collaboratori\/([^/]+)(?:\/(.*))?$/);
  if (!match) return null;

  const uid = match[1];
  const rest = match[2] ?? "";

  if (rest.startsWith("corsi/")) {
    return `/formazione/collaboratori/${uid}`;
  }

  return "/formazione/collaboratori";
}

export function FormazioneNav({ canMonitor = false }: { canMonitor?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const { openIntro } = useFormazioneIntro();
  const courseDetail = isCourseDetail(pathname);
  const collaboratorBackHref = collaboratorNavBack(pathname);
  const items = getFormazioneMenuItems(canMonitor);

  return (
    <nav className="mt-6 border-b border-[var(--line)]">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div className="flex flex-wrap gap-6">
          {items.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            const showBack =
              (href === "/formazione/corsi" && courseDetail) ||
              (href === "/formazione/collaboratori" && collaboratorBackHref != null);
            const fallbackHref =
              href === "/formazione/corsi" && courseDetail
                ? "/formazione/corsi"
                : href === "/formazione/collaboratori" && collaboratorBackHref
                  ? collaboratorBackHref
                  : href;
            const itemClass = `-mb-px inline-flex items-center gap-2 border-b-2 pb-3 text-sm font-semibold transition ${
              active
                ? "border-[#FB8C00] text-[var(--navy)]"
                : "border-transparent text-[var(--muted)] hover:text-[var(--navy)]"
            }`;

            if (showBack && active) {
              return (
                <button
                  key={href}
                  type="button"
                  onClick={() => navigateBack(router, fallbackHref)}
                  title="Torna indietro"
                  aria-label={`Indietro · ${label}`}
                  className={itemClass}
                >
                  <ArrowLeft className="h-4 w-4 shrink-0 text-[var(--accent,#0e7490)]" />
                  {label}
                </button>
              );
            }

            return (
              <Link
                key={href}
                href={href}
                title={label}
                aria-label={label}
                className={itemClass}
              >
                <Icon className="h-4 w-4 shrink-0 opacity-80" />
                {label}
              </Link>
            );
          })}
        </div>
        <button
          type="button"
          onClick={openIntro}
          title="Riapri il percorso di formazione"
          className="-mb-px inline-flex items-center gap-1.5 border-b-2 border-transparent pb-3 text-sm font-semibold text-[var(--muted)] transition hover:text-[var(--navy)]"
        >
          <CircleHelp className="h-4 w-4 shrink-0 opacity-80" />
          Percorso
        </button>
      </div>
    </nav>
  );
}

export const FORMAZIONE_MENU_ITEMS = BASE_ITEMS;
export const FORMAZIONE_COLLABORATORI_ITEM = COLLABORATORI_ITEM;
