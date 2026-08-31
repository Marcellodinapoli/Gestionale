import { mandantiDb } from "@/lib/mandantiRepo";
import { prisma } from "@/lib/prisma";
import type { LatoEconomico } from "@/lib/mandantePerimetri";
import { parsePerimetri, numeroMandantePerimetro } from "@/lib/mandantePerimetri";
import type { GruppoMandanteAssegnazione } from "@/lib/gruppoMandanti";

export {
  performancePerc,
  provvigionePercEffettiva,
  scaglioneProvvigioneAttuale,
  etichettaScaglione,
  etichettaScaglioni,
  etichettaIncentivoCash,
  etichettaIncentiviCash,
  etichettaIncentivi,
  etichettaIncentivo,
  provvigioniMetodoLabelEntries,
  provvigioniCodiceLabelEntries,
  mancanoPezziPerScaglione,
  type MetricheCodiceScarico,
  type PerformanceProvvigioni,
} from "@/lib/provvigioniPerimetroUi";

export type PerimetroProvvigioniConfig = {
  nome: string;
  mandanteId: string;
  mandanteCodice: string;
  /** Regole pagate agli operatori su questo perimetro. */
  pagata: LatoEconomico;
  codiciScarico: { codice: string; descrizione: string }[];
};

export async function configProvvigioniPerimetriGruppo(
  tenantId: string,
  assegnazioni: GruppoMandanteAssegnazione[]
): Promise<PerimetroProvvigioniConfig[]> {
  if (!assegnazioni.length) return [];

  const mandantiRows = await mandantiDb({ tenantId, tenantSlug: tenantId }).findMany({
    where: {
      tenantId,
      id: { in: [...new Set(assegnazioni.map((a) => a.mandanteId))] },
    },
    select: { id: true, codice: true, perimetri: true },
  });

  const out: PerimetroProvvigioniConfig[] = [];
  for (const a of assegnazioni) {
    const m = mandantiRows.find((x) => x.id === a.mandanteId);
    if (!m) continue;
    const perimetri = parsePerimetri(m.perimetri);
    const targets = !a.perimetriIds.length
      ? perimetri
      : a.perimetriIds
          .map((id) => perimetri.find((p) => p.id === id))
          .filter((p): p is (typeof perimetri)[number] => Boolean(p));

    for (const p of targets) {
      out.push({
        nome: numeroMandantePerimetro(p),
        mandanteId: m.id,
        mandanteCodice: m.codice,
        pagata: p.pagata,
        codiciScarico: p.codiciScarico,
      });
    }
  }

  return out.sort((a, b) =>
    a.nome.localeCompare(b.nome, "it", { numeric: true })
  );
}

export async function configProvvigioniMandanti(
  tenantId: string,
  opts?: { mandanteIds?: string[]; soloPerimetro?: string }
): Promise<PerimetroProvvigioniConfig[]> {
  const mandantiRows = await mandantiDb({ tenantId, tenantSlug: tenantId }).findMany({
    where: {
      tenantId,
      ...(opts?.mandanteIds?.length ? { id: { in: opts.mandanteIds } } : {}),
    },
    select: { id: true, codice: true, perimetri: true },
    orderBy: { codice: "asc" },
  });

  const out: PerimetroProvvigioniConfig[] = [];
  for (const m of mandantiRows) {
    const perimetri = parsePerimetri(m.perimetri);
    for (const p of perimetri) {
      const nome = numeroMandantePerimetro(p);
      if (!nome) continue;
      if (opts?.soloPerimetro && opts.soloPerimetro !== nome) continue;
      out.push({
        nome,
        mandanteId: m.id,
        mandanteCodice: m.codice,
        pagata: p.pagata,
        codiciScarico: p.codiciScarico,
      });
    }
  }

  return out.sort((a, b) =>
    a.nome.localeCompare(b.nome, "it", { numeric: true })
  );
}
