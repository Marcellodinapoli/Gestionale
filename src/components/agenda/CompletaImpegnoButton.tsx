"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { completaImpegnoLiberoAction } from "@/actions/impegnoAgenda";

export function CompletaImpegnoButton({
  impegnoId,
  label = "Completato",
  className,
}: {
  impegnoId: string;
  label?: string;
  className?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onSubmit(formData: FormData) {
    setPending(true);
    try {
      await completaImpegnoLiberoAction(formData);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <form action={onSubmit}>
      <input type="hidden" name="impegnoId" value={impegnoId} />
      <button
        type="submit"
        disabled={pending}
        className={
          className ||
          "h-8 rounded border border-[var(--line)] bg-white px-3 text-xs font-medium text-[#132033] hover:bg-slate-50 disabled:opacity-60"
        }
      >
        {pending ? "…" : label}
      </button>
    </form>
  );
}
