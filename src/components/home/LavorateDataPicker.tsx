"use client";

import { useRouter } from "next/navigation";
import { formatDataIso } from "@/lib/lavorateOggiUi";

export function LavorateDataPicker({
  value,
  home = false,
}: {
  value: string;
  home?: boolean;
}) {
  const router = useRouter();

  function navigate(next: string) {
    if (home) {
      const sp = new URLSearchParams(window.location.search);
      const gruppo = sp.get("gruppo");
      const qs = new URLSearchParams();
      if (gruppo) qs.set("gruppo", gruppo);
      if (next !== formatDataIso(new Date())) qs.set("lavorateData", next);
      router.push(qs.size ? `/?${qs.toString()}` : "/");
      return;
    }
    const sp = new URLSearchParams(window.location.search);
    sp.set("page", "1");
    if (next) sp.set("lavorateData", next);
    else sp.delete("lavorateData");
    sp.delete("lavorateOggi");
    router.push(`/pratiche?${sp.toString()}`);
  }

  return (
    <input
      type="date"
      value={value}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => navigate(e.target.value)}
      className="mt-1 h-7 w-full max-w-[148px] rounded border border-[var(--line)] bg-white px-1.5 text-[11px] text-[var(--navy)]"
      aria-label="Data lavorazioni"
      title="Filtra per data"
    />
  );
}
