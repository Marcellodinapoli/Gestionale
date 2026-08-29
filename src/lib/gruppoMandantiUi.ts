import { etichettaPerimetro } from "@/lib/mandantePerimetri";

/** Tipi/helper gruppo mandanti — senza Prisma/Firebase (safe per Client Components). */

export type GruppoMandanteAssegnazione = {
  mandanteId: string;
  perimetriIds: string[];
};

export function parseGruppoMandanti(
  raw: string | null | undefined
): GruppoMandanteAssegnazione[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const o = item as Record<string, unknown>;
        const mandanteId = String(o.mandanteId || "").trim();
        if (!mandanteId) return null;
        const perimetriIds = Array.isArray(o.perimetriIds)
          ? o.perimetriIds.map((id) => String(id).trim()).filter(Boolean)
          : [];
        return { mandanteId, perimetriIds } satisfies GruppoMandanteAssegnazione;
      })
      .filter((x): x is GruppoMandanteAssegnazione => x != null);
  } catch {
    return [];
  }
}

export function serializeGruppoMandanti(items: GruppoMandanteAssegnazione[]): string {
  return JSON.stringify(items);
}

export function etichettaGruppoMandanti(
  assegnazioni: GruppoMandanteAssegnazione[],
  mandanti: Array<{
    id: string;
    codice: string;
    ragioneSociale: string;
    perimetri: Array<{
      id: string;
      nomeInterno: string;
      nomeMandante: string;
      descrizione: string;
      label: string;
    }>;
  }>
): string[] {
  return assegnazioni
    .map((a) => {
      const m = mandanti.find((x) => x.id === a.mandanteId);
      if (!m) return null;
      if (!a.perimetriIds.length) {
        return m.perimetri.length
          ? `${m.codice} · tutti i perimetri`
          : `${m.codice} · ${m.ragioneSociale}`;
      }
      const nomi = a.perimetriIds
        .map((id) => {
          const p = m.perimetri.find((x) => x.id === id);
          return p ? etichettaPerimetro(p) : null;
        })
        .filter(Boolean);
      return `${m.codice}${nomi.length ? ` · ${nomi.join(", ")}` : ""}`;
    })
    .filter((x): x is string => Boolean(x));
}
