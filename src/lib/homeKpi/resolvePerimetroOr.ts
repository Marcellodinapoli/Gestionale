import "server-only";
import { mandantiDb } from "@/lib/mandantiRepo";
import { parsePerimetriList } from "@/lib/mandantePerimetri";
import { gruppoMandantiPraticaWhere } from "@/lib/gruppoMandanti";
import type { HomeScopeFilter } from "@/lib/data/contracts/dashboard";

export async function resolvePerimetroOr(
  tenantId: string,
  gruppoMandanti: Array<{ mandanteId: string; perimetriIds: string[] }>
): Promise<HomeScopeFilter["perimetroOr"]> {
  if (!gruppoMandanti.length) return undefined;
  const mandantiRows = await mandantiDb({ tenantId, tenantSlug: tenantId }).findMany({
    where: { tenantId, id: { in: [...new Set(gruppoMandanti.map((a) => a.mandanteId))] } },
    select: { id: true, perimetri: true },
  });
  const mandanti = mandantiRows.map((m) => ({
    id: m.id as string,
    perimetri: parsePerimetriList(m.perimetri),
    perimetriRaw: m.perimetri,
  }));
  const prismaOr = gruppoMandantiPraticaWhere(gruppoMandanti, mandanti);
  if (!prismaOr?.OR) return undefined;
  const out: NonNullable<HomeScopeFilter["perimetroOr"]> = [];
  for (const clause of prismaOr.OR as Array<Record<string, unknown>>) {
    const mandanteId = String(clause.mandanteId || "");
    const nm = clause.numeroMandante as { in?: string[] } | undefined;
    out.push({
      mandanteId,
      numeriMandante: nm?.in?.map(String),
    });
  }
  return out.length ? out : undefined;
}
