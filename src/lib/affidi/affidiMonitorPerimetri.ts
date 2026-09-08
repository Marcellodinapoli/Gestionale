import {
  chiaviMatchPerimetro,
  etichettaPerimetro,
  parsePerimetriList,
} from "@/lib/mandantePerimetri";

export type PerimetroFiltroAffidi = {
  /** Chiave import / filtro (nomeMandante). */
  value: string;
  /** Etichetta UI: acronimo · descrizione (mai il solo lotto). */
  label: string;
};

export type MandantePerimetriAffidi = {
  id: string;
  codice: string;
  ragioneSociale: string;
  perimetri: PerimetroFiltroAffidi[];
  /** JSON perimetri mandante (per match lotto ↔ perimetro). */
  perimetriRaw: string | null;
};

/**
 * Opzioni perimetro solo da config mandante (non dai lotti pratica).
 * Label = etichettaPerimetro (acronimo · descrizione).
 */
export function mandantiConPerimetriAffidi(
  mandanti: Array<{
    id: string;
    codice: string;
    ragioneSociale: string;
    perimetri: unknown;
  }>
): MandantePerimetriAffidi[] {
  return mandanti.map((m) => {
    const raw =
      typeof m.perimetri === "string"
        ? m.perimetri
        : m.perimetri == null
          ? null
          : JSON.stringify(m.perimetri);
    const seen = new Set<string>();
    const perimetri: PerimetroFiltroAffidi[] = [];
    for (const p of parsePerimetriList(raw)) {
      const value = p.nomeMandante.trim();
      if (!value || seen.has(value)) continue;
      seen.add(value);
      perimetri.push({
        value,
        label: etichettaPerimetro(p) || p.label || value,
      });
    }
    perimetri.sort((a, b) => a.label.localeCompare(b.label, "it"));
    return {
      id: m.id,
      codice: m.codice,
      ragioneSociale: m.ragioneSociale,
      perimetri,
      perimetriRaw: raw,
    };
  });
}

export function risolviFiltriMonitorAffidi(
  mandanti: MandantePerimetriAffidi[],
  mandatoId?: string,
  perimetroRaw?: string
) {
  const mandanteOk =
    mandatoId && mandanti.some((m) => m.id === mandatoId) ? mandatoId : undefined;
  const perimetroOk = (() => {
    if (!perimetroRaw?.trim()) return undefined;
    const p = perimetroRaw.trim();
    const match = (m: MandantePerimetriAffidi) =>
      m.perimetri.some((x) => x.value === p);
    if (mandanteOk) {
      const m = mandanti.find((x) => x.id === mandanteOk);
      return m && match(m) ? p : undefined;
    }
    return mandanti.some(match) ? p : undefined;
  })();
  return { mandanteOk, perimetroOk };
}

/** Numeri mandante (lotti / chiavi) che corrispondono al perimetro selezionato. */
export function numeriMandantePerFiltroPerimetro(
  mandanti: MandantePerimetriAffidi[],
  perimetro?: string,
  mandanteId?: string
): string[] {
  const key = perimetro?.trim();
  if (!key) return [];
  const list = mandanteId
    ? mandanti.filter((m) => m.id === mandanteId)
    : mandanti;
  return [
    ...new Set(
      list.flatMap((m) => chiaviMatchPerimetro(m.perimetriRaw, key))
    ),
  ];
}

export function filtraPraticheAffidiMonitor<
  T extends { mandanteId: string; numeroMandante: string | null },
>(
  pratiche: T[],
  mandanti: MandantePerimetriAffidi[],
  mandanteId?: string,
  perimetro?: string
): T[] {
  if (!mandanteId && !perimetro) return pratiche;
  const numeri = perimetro
    ? numeriMandantePerFiltroPerimetro(mandanti, perimetro, mandanteId)
    : [];
  const numeriSet = numeri.length ? new Set(numeri) : null;
  return pratiche.filter((p) => {
    if (mandanteId && p.mandanteId !== mandanteId) return false;
    if (numeriSet) {
      const lot = p.numeroMandante?.trim() ?? "";
      if (!lot || !numeriSet.has(lot)) return false;
    }
    return true;
  });
}

export function etichettaFiltriMonitorAffidi(
  mandanti: MandantePerimetriAffidi[],
  mandanteOk?: string,
  perimetroOk?: string
) {
  const mandanteSel = mandanteOk
    ? mandanti.find((m) => m.id === mandanteOk)
    : undefined;
  const periLabel = perimetroOk
    ? mandanti
        .flatMap((m) => m.perimetri)
        .find((p) => p.value === perimetroOk)?.label ?? perimetroOk
    : null;
  return (
    [
      mandanteSel ? `Mandato: ${mandanteSel.codice}` : null,
      periLabel ? `Perimetro: ${periLabel}` : null,
    ]
      .filter(Boolean)
      .join(" · ") || "Tutti i mandati e perimetri"
  );
}

/** Compat: elenco valori perimetro (chiavi) per un mandato. */
export function valoriPerimetroMandante(
  mandanti: MandantePerimetriAffidi[],
  mandatoId?: string
): PerimetroFiltroAffidi[] {
  const source = !mandatoId
    ? mandanti.flatMap((m) => m.perimetri)
    : mandanti.find((m) => m.id === mandatoId)?.perimetri ?? [];
  const byValue = new Map<string, string>();
  for (const p of source) {
    if (!byValue.has(p.value)) byValue.set(p.value, p.label);
  }
  return [...byValue.entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, "it"));
}
