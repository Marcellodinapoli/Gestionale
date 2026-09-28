"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { isAwaitingSectionActivation } from "@/lib/platform/modules";
import type { TenantPlatformConfig } from "@/lib/platform/modules";

const ALLOWED_WHEN_AWAITING = new Set([
  "/attivazione-sezioni",
  "/account",
  "/cambia-password",
]);

export function SectionActivationGate({
  platform,
}: {
  platform?: Pick<TenantPlatformConfig, "enabledModules"> | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const awaiting = isAwaitingSectionActivation(platform?.enabledModules);

  useEffect(() => {
    if (!awaiting) {
      if (pathname === "/attivazione-sezioni") {
        router.replace("/");
      }
      return;
    }
    const allowed = [...ALLOWED_WHEN_AWAITING].some(
      (p) => pathname === p || pathname.startsWith(`${p}/`)
    );
    if (!allowed) {
      router.replace("/attivazione-sezioni");
    }
  }, [awaiting, pathname, router]);

  return null;
}
