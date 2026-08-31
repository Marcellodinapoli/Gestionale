import type { Prisma } from "@prisma/client";
import { mandantiDb } from "@/lib/mandantiRepo";
import { prisma } from "@/lib/prisma";
import { parsePerimetri, numeroMandantePerimetro } from "@/lib/mandantePerimetri";

export {
  parseGruppoMandanti,
  serializeGruppoMandanti,
  etichettaGruppoMandanti,
  type GruppoMandanteAssegnazione,
} from "@/lib/gruppoMandantiUi";

import type { GruppoMandanteAssegnazione } from "@/lib/gruppoMandantiUi";

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

  const mandantiRows = await mandantiDb({ tenantId, tenantSlug: tenantId }).findMany({
    where: {
      tenantId,
      id: { in: [...new Set(assegnazioni.map((a) => a.mandanteId))] },
    },
    select: { id: true, perimetri: true },
  });

  const nomi: string[] = [];
  for (const a of assegnazioni) {
    const m = mandantiRows.find((x) => x.id === a.mandanteId);
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
