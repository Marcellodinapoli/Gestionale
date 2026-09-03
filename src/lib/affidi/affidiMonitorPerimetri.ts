import { parsePerimetri } from "@/lib/mandantePerimetri";

export type MandantePerimetriAffidi = {
  id: string;
  codice: string;
  ragioneSociale: string;
  perimetri: string[];
};

export function mandantiConPerimetriAffidi(
  mandanti: Array<{
    id: string;
    codice: string;
    ragioneSociale: string;
    perimetri: unknown;
  }>,
  lottiPerMandante?: Map<string, Set<string>>
): MandantePerimetriAffidi[] {
  return mandanti.map((m) => {
    const fromConfig = parsePerimetri(m.perimetri).map((p) => p.nomeMandante);
    const fromPratiche = [...(lottiPerMandante?.get(m.id) ?? [])];
    const perimetri = [...new Set([...fromConfig, ...fromPratiche])].sort((a, b) =>
      a.localeCompare(b, "it")
    );
    return { id: m.id, codice: m.codice, ragioneSociale: m.ragioneSociale, perimetri };
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
    if (mandanteOk) {
      const m = mandanti.find((x) => x.id === mandanteOk);
      return m?.perimetri.includes(p) ? p : undefined;
    }
    return mandanti.some((m) => m.perimetri.includes(p)) ? p : undefined;
  })();
  return { mandanteOk, perimetroOk };
}

export function filtraPraticheAffidiMonitor<
  T extends { mandanteId: string; numeroMandante: string | null },
>(pratiche: T[], mandanteId?: string, perimetro?: string): T[] {
  if (!mandanteId && !perimetro) return pratiche;
  return pratiche.filter((p) => {
    if (mandanteId && p.mandanteId !== mandanteId) return false;
    if (perimetro && (p.numeroMandante?.trim() ?? "") !== perimetro) return false;
    return true;
  });
}

export function etichettaFiltriMonitorAffidi(
  mandanti: MandantePerimetriAffidi[],
  mandanteOk?: string,
  perimetroOk?: string
) {
  const mandanteSel = mandanteOk ? mandanti.find((m) => m.id === mandanteOk) : undefined;
  return (
    [
      mandanteSel ? `Mandato: ${mandanteSel.codice}` : null,
      perimetroOk ? `Perimetro: ${perimetroOk}` : null,
    ]
      .filter(Boolean)
      .join(" · ") || "Tutti i mandati e perimetri"
  );
}
