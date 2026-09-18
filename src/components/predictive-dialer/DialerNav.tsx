"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, PhoneForwarded, Settings, Target } from "lucide-react";
import { SectionTabNav, sectionTabClass } from "@/components/ui/SectionTabNav";

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
    <SectionTabNav label="Sezioni Dialer">
      {items.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            title={label}
            aria-current={active ? "page" : undefined}
            className={sectionTabClass(active)}
          >
            <Icon className="h-4 w-4 shrink-0 opacity-80" />
            {label}
          </Link>
        );
      })}
    </SectionTabNav>
  );
}
