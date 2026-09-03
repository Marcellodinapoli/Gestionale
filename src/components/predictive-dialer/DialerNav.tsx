"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, PhoneForwarded, Settings, Target } from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  icon: typeof PhoneForwarded;
};

function isActive(pathname: string, href: string) {
  if (href === "/predictive-dialer") {
    return pathname === href;
  }
  if (href === "/predictive-dialer/campagne") {
    return pathname === href || pathname.startsWith("/predictive-dialer/campagne/");
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DialerNav({
  canManage = false,
  canAdmin = false,
}: {
  canManage?: boolean;
  canAdmin?: boolean;
}) {
  const pathname = usePathname();

  const items: NavItem[] = [
    { href: "/predictive-dialer", label: "Operatore", icon: PhoneForwarded },
  ];
  if (canManage) {
    items.push(
      { href: "/predictive-dialer/campagne", label: "Campagne", icon: Target },
      { href: "/predictive-dialer/monitor", label: "Monitor", icon: Activity }
    );
  }
  if (canAdmin) {
    items.push({
      href: "/predictive-dialer/admin",
      label: "Configurazione",
      icon: Settings,
    });
  }

  return (
    <nav className="border-b border-[var(--line)]">
      <div className="flex flex-wrap gap-6">
        {items.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              title={label}
              aria-current={active ? "page" : undefined}
              className={`-mb-px inline-flex items-center gap-2 border-b-2 pb-3 text-sm font-semibold transition ${
                active
                  ? "border-[#FB8C00] text-[var(--navy)]"
                  : "border-transparent text-[var(--muted)] hover:text-[var(--navy)]"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0 opacity-80" />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
