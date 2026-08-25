export type PracticeDataRow = {
  label: string;
  value: string;
};

function compactLabel(label: string) {
  return label.toLowerCase().replace(/[\s._-]/g, "");
}

export function normalizePracticeData(raw: unknown): PracticeDataRow[] {
  if (!Array.isArray(raw)) return [];

  const items: PracticeDataRow[] = raw.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    return [
      {
        label: String(row.label ?? "").trim(),
        value: String(row.value ?? "").trim(),
      },
    ];
  });

  let rateDaPagareCount = 0;
  let hasRatePagate = false;
  let hasRateTotali = false;

  for (const item of items) {
    const label = compactLabel(item.label);
    if (label === "ratedapagare") rateDaPagareCount++;
    if (label === "ratepagate") hasRatePagate = true;
    if (label === "ratetotali") hasRateTotali = true;
  }

  if (rateDaPagareCount < 2 || hasRateTotali) return items;

  let seenRateDaPagare = 0;
  for (const item of items) {
    const label = compactLabel(item.label);
    if (label !== "ratedapagare") continue;
    seenRateDaPagare++;
    if (seenRateDaPagare >= 2 && (hasRatePagate || seenRateDaPagare > 1)) {
      item.label = "Rate totali";
    }
  }

  return items;
}

/** Practice data per UI utente (senza terza persona). */
export function practiceDataForDisplay(raw: unknown): PracticeDataRow[] {
  return normalizePracticeData(raw).filter((item) => {
    const label = item.label.toLowerCase();
    return !label.includes("terza");
  });
}

export function parsePracticeData(raw: unknown): PracticeDataRow[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    if (typeof item === "string") {
      const text = item.trim();
      return text ? [{ label: "", value: text }] : [];
    }
    if (item && typeof item === "object") {
      const row = item as Record<string, unknown>;
      const label = String(row.label ?? "").trim();
      const value = String(row.value ?? row.text ?? row.title ?? "").trim();
      if (!label && !value) return [];
      return [{ label, value }];
    }
    return [];
  });
}
