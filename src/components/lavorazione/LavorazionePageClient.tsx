"use client";

import type { ReactNode } from "react";
import { LavorazioneRefreshProvider } from "@/components/lavorazione/LavorazioneRefresh";

export function LavorazionePageClient({ children }: { children: ReactNode }) {
  return <LavorazioneRefreshProvider>{children}</LavorazioneRefreshProvider>;
}
