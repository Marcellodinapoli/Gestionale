import type { ReactNode } from "react";
import { requireModule, requireNavPage } from "@/lib/guard";

export default async function PortafogliLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireModule("utp-npl");
  await requireNavPage("portafogli");
  return children;
}
