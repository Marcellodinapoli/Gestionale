import type { ReactNode } from "react";
import { requireModule, requireNavPage } from "@/lib/guard";

export default async function RecruitingLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireModule("recruiting");
  await requireNavPage("recruiting");
  return children;
}
