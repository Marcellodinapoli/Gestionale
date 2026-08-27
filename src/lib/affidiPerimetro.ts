import type { GruppoMandanteAssegnazione } from "@/lib/gruppoMandanti";

export type PerimetroGruppoRef = {
  mandanteId: string;
  mandanteCodice: string;
  mandanteNome: string;
  /** Codice mandante (numeroMandante pratiche). */
  perimetro: string;
  /** Acronimo interno del perimetro. */
  acronimo: string;
  /** Etichetta interno · mandante. */
  perimetroLabel: string;
};

export type MandantePerimetroOption = {
  id: string;
  codice: string;
  ragioneSociale: string;
  perimetri: Array<{
    id: string;
    nomeInterno: string;
    nomeMandante: string;
    label: string;
  }>;
};

function refPerimetro(
  m: MandantePerimetroOption,
  p: MandantePerimetroOption["perimetri"][number]
): PerimetroGruppoRef {
  return {
    mandanteId: m.id,
    mandanteCodice: m.codice,
    mandanteNome: m.ragioneSociale,
    perimetro: p.nomeMandante.trim(),
    acronimo: p.nomeInterno.trim(),
    perimetroLabel: p.label,
  };
}

/** Perimetro pratica = lotto (numeroMandante) o "—" se assente. */
export function perimetroPratica(numeroMandante?: string | null): string {
  return numeroMandante?.trim() || "—";
}

export function chiavePerimetro(mandanteId: string, perimetro: string): string {
  return `${mandanteId}|${perimetro}`;
}

/** Elenco mandanti/perimetri configurati sul gruppo (anche senza pratiche). */
export function elencoPerimetriGruppoConfig(
  assegnazioni: GruppoMandanteAssegnazione[],
  mandanti: MandantePerimetroOption[]
): PerimetroGruppoRef[] {
  const out: PerimetroGruppoRef[] = [];

  for (const a of assegnazioni) {
    const m = mandanti.find((x) => x.id === a.mandanteId);
    if (!m) continue;

    if (!a.perimetriIds.length) {
      if (m.perimetri.length) {
        for (const p of m.perimetri) {
          if (!p.nomeMandante.trim()) continue;
          out.push(refPerimetro(m, p));
        }
      } else {
        out.push({
          mandanteId: m.id,
          mandanteCodice: m.codice,
          mandanteNome: m.ragioneSociale,
          perimetro: "—",
          acronimo: "",
          perimetroLabel: "—",
        });
      }
      continue;
    }

    for (const pid of a.perimetriIds) {
      const p = m.perimetri.find((x) => x.id === pid);
      if (!p?.nomeMandante.trim()) continue;
      out.push(refPerimetro(m, p));
    }
  }

  return sortPerimetroRefs(out);
}

/** Tutti i mandati/perimetri del tenant (back office). */
export function elencoPerimetriTuttiMandanti(
  mandanti: MandantePerimetroOption[]
): PerimetroGruppoRef[] {
  const out: PerimetroGruppoRef[] = [];

  for (const m of mandanti) {
    if (m.perimetri.length) {
      for (const p of m.perimetri) {
        if (!p.nomeMandante.trim()) continue;
        out.push(refPerimetro(m, p));
      }
    } else {
      out.push({
        mandanteId: m.id,
        mandanteCodice: m.codice,
        mandanteNome: m.ragioneSociale,
        perimetro: "—",
        acronimo: "",
        perimetroLabel: "—",
      });
    }
  }

  return sortPerimetroRefs(out);
}

function sortPerimetroRefs(rows: PerimetroGruppoRef[]): PerimetroGruppoRef[] {
  return [...rows].sort((a, b) => {
    const m = a.mandanteCodice.localeCompare(b.mandanteCodice, "it");
    if (m !== 0) return m;
    if (a.perimetro === "—" && b.perimetro !== "—") return 1;
    if (b.perimetro === "—" && a.perimetro !== "—") return -1;
    return a.perimetro.localeCompare(b.perimetro, "it", { numeric: true });
  });
}

export function praticaInPerimetroRef(
  p: { mandanteId: string; numeroMandante?: string | null },
  ref: Pick<PerimetroGruppoRef, "mandanteId" | "perimetro">
): boolean {
  if (p.mandanteId !== ref.mandanteId) return false;
  return perimetroPratica(p.numeroMandante) === ref.perimetro;
}

export function filtraPratichePerPerimetro<
  T extends { mandanteId: string; numeroMandante?: string | null },
>(pratiche: T[], ref: Pick<PerimetroGruppoRef, "mandanteId" | "perimetro">): T[] {
  return pratiche.filter((p) => praticaInPerimetroRef(p, ref));
}

export function parsePerimetroAffidi(raw?: string | null): string | undefined {
  if (!raw) return undefined;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}
