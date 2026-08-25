import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parsePerimetri, numeroMandantePerimetro, etichettaPerimetro } from "@/lib/mandantePerimetri";

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
    perimetri: Array<{ id: string; nomeInterno: string; nomeMandante: string; label: string }>;
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

/**
 * Filtro pratiche sui mandanti/perimetri assegnati al gruppo.
 * `null` = nessun perimetro configurato (nessuna pratica in scope).
 */
export function gruppoMandantiPraticaWhere(
  assegnazioni: GruppoMandanteAssegnazione[],
  mandanti: Array<{
    id: string;
    perimetri: Array<{ id: string; nomeInterno: string; nomeMandante: string }>;
  }>
): Prisma.PraticaWhereInput | null {
  if (!assegnazioni.length) return null;

  const ors: Prisma.PraticaWhereInput[] = [];
  for (const a of assegnazioni) {
    const m = mandanti.find((x) => x.id === a.mandanteId);
    if (!m) continue;
    if (!a.perimetriIds.length) {
      ors.push({ mandanteId: a.mandanteId });
      continue;
    }
    const nomi = a.perimetriIds
      .map((id) => m.perimetri.find((p) => p.id === id)?.nomeMandante?.trim())
      .filter((n): n is string => Boolean(n));
    if (!nomi.length) continue;
    ors.push({
      mandanteId: a.mandanteId,
      numeroMandante: { in: nomi },
    });
  }

  if (!ors.length) return null;
  return { OR: ors };
}

/** Nomi perimetro (numeroMandante) configurati sul gruppo, ordinati. */
export async function nomiPerimetriGruppo(
  tenantId: string,
  assegnazioni: GruppoMandanteAssegnazione[]
): Promise<string[]> {
  if (!assegnazioni.length) return [];

  const mandantiDb = await prisma.mandante.findMany({
    where: {
      tenantId,
      id: { in: [...new Set(assegnazioni.map((a) => a.mandanteId))] },
    },
    select: { id: true, perimetri: true },
  });

  const nomi: string[] = [];
  for (const a of assegnazioni) {
    const m = mandantiDb.find((x) => x.id === a.mandanteId);
    if (!m) continue;
    const perimetri = parsePerimetri(m.perimetri);
    if (!a.perimetriIds.length) {
      nomi.push(...perimetri.map((p) => numeroMandantePerimetro(p)).filter(Boolean));
    } else {
      for (const id of a.perimetriIds) {
        const p = perimetri.find((x) => x.id === id);
        const nome = p ? numeroMandantePerimetro(p) : "";
        if (nome) nomi.push(nome);
      }
    }
  }

  return [...new Set(nomi)].sort((a, b) => a.localeCompare(b, "it", { numeric: true }));
}
