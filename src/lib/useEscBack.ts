"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

function isFormField(target: EventTarget | null) {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}

export function useEscBack(href: string, enabled = true) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled) return;

    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape" || isFormField(e.target)) return;
      e.preventDefault();
      router.push(href);
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled, href, router]);
}
