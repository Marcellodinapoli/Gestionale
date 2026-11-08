"use client";

import dynamic from "next/dynamic";

export const ContabilePreviewLazy = dynamic(
  () =>
    import("@/components/pratica/PraticaExtraLazy").then((mod) => ({
      default: mod.ContabilePreviewLazy,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full min-h-0 min-w-0 flex-col border-b border-[var(--line)] lg:col-span-4 lg:self-stretch lg:border-b-0 lg:border-l lg:border-[var(--line)]">
        <div className="flex items-center justify-center py-12 text-sm text-[var(--muted)]">
          Caricamento contabile...
        </div>
      </div>
    ),
  }
);

export const RegistroNoteLazy = dynamic(
  () =>
    import("@/components/pratica/PraticaExtraLazy").then((mod) => ({
      default: mod.RegistroNoteLazy,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-center py-12 text-sm text-[var(--muted)]">
          Caricamento note...
        </div>
      </div>
    ),
  }
);
