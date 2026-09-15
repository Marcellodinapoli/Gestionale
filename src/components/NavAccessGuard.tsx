"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  NAV_PAGES,
  navPageByHref,
  type NavPageId,
} from "@/lib/navVisibility/catalog";

/** Blocca URL diretti a pagine nascoste dalle preferenze di visibilità. */
export function NavAccessGuard({
  navVisibility,
}: {
  navVisibility: Partial<Record<NavPageId, boolean>>;
}) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const page = navPageByHref(pathname);
    if (!page || page.locked) return;
    if (navVisibility[page.id] !== false) return;

    const fallback = NAV_PAGES.find(
      (p) =>
        p.id !== page.id &&
        !p.locked &&
        p.id !== "home" &&
        navVisibility[p.id] !== false
    );
    router.replace(fallback?.pathPrefix || "/account");
  }, [pathname, navVisibility, router]);

  return null;
}
