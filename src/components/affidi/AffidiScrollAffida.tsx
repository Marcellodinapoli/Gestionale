"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

/** Scroll alla sezione affida quando ?sezione=affida */
export function AffidiScrollAffida() {
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get("sezione") !== "affida") return;
    const el = document.getElementById("affida");
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [searchParams]);

  return null;
}
