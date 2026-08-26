"use client";

import { useEffect, useRef, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const DEBOUNCE_MS = 350;

/**
 * Ricerca con debounce: aggiorna `q` in URL senza submit manuale,
 * evitando ricaricamenti a ogni tasto.
 */
export function DebouncedSearchInput({
  name = "q",
  defaultValue,
  placeholder,
  className,
  formId,
}: {
  name?: string;
  defaultValue?: string;
  placeholder?: string;
  className?: string;
  /** Se presente, al debounce fa submit del form (conserva altri filtri). */
  formId?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSent = useRef(defaultValue || "");

  useEffect(() => {
    lastSent.current = defaultValue || "";
  }, [defaultValue]);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  function apply(value: string) {
    const trimmed = value.trim();
    if (trimmed === lastSent.current.trim()) return;
    lastSent.current = trimmed;

    if (formId) {
      const form = document.getElementById(formId) as HTMLFormElement | null;
      if (form) {
        const input = form.elements.namedItem(name) as HTMLInputElement | null;
        if (input) input.value = trimmed;
        form.requestSubmit();
        return;
      }
    }

    const sp = new URLSearchParams(searchParams.toString());
    if (trimmed) sp.set(name, trimmed);
    else sp.delete(name);
    sp.delete("page");
    const qs = sp.toString();
    startTransition(() => {
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  }

  return (
    <input
      name={name}
      defaultValue={defaultValue || ""}
      placeholder={placeholder}
      className={className}
      autoComplete="off"
      onChange={(e) => {
        const v = e.target.value;
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => apply(v), DEBOUNCE_MS);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          if (timer.current) clearTimeout(timer.current);
          apply((e.target as HTMLInputElement).value);
        }
      }}
    />
  );
}
