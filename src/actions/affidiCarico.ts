"use server";

import { requirePermission } from "@/lib/guard";
import { incassiGuadagnoAnnoOperatore } from "@/lib/affidi/incassiGuadagnoAnnoOperatore";
import { praticaMonitorWhere } from "@/lib/affidi/loadAffidiMonitoraggio";
import { mandantiDbFromUser } from "@/lib/mandantiRepo";
import { praticaDbFromUser } from "@/lib/praticheRepo";
import {
  mandantiConPerimetriAffidi,
  numeriMandantePerFiltroPerimetro,
  risolviFiltriMonitorAffidi,
} from "@/lib/affidi/affidiMonitorPerimetri";
import { parsePerimetroAffidi } from "@/lib/affidiPerimetro";

export async function loadIncassiGuadagnoAnnoOperatoreAction(params: {
  operatoreId: string;
  anno: number;
  caricoMandato?: string;
  caricoPerimetro?: string;
  /** Lotti già risolti dal filtro pagina (stesso match di Incassato/Guadagno mese). */
  numeriMandante?: string[];
}) {
  const user = await requirePermission("pratiche:assign");
  const operatoreId = params.operatoreId?.trim();
  if (!operatoreId) throw new Error("Operatore mancante");

  const anno = Number(params.anno);
  if (!Number.isFinite(anno) || anno < 2000 || anno > 2100) {
    throw new Error("Anno non valido");
  }

  const mandatoRaw = params.caricoMandato?.trim() || undefined;
  const perimetroRaw = parsePerimetroAffidi(params.caricoPerimetro);

  let mandanteOk = mandatoRaw;
  let perimetroOk = perimetroRaw;
  let numeri = (params.numeriMandante || []).map((n) => n.trim()).filter(Boolean);

  if (mandatoRaw || perimetroRaw) {
    const mandantiDb = await mandantiDbFromUser(user).findMany({
      where: { tenantId: user.tenantId },
      select: { id: true, codice: true, ragioneSociale: true, perimetri: true },
    });
    const mandanti = mandantiConPerimetriAffidi(mandantiDb);
    const resolved = risolviFiltriMonitorAffidi(mandanti, mandatoRaw, perimetroRaw);
    mandanteOk = resolved.mandanteOk;
    perimetroOk = resolved.perimetroOk;

    if (perimetroOk && !numeri.length) {
      const scope = await praticaDbFromUser(user).findMany({
        where: {
          tenantId: user.tenantId,
          ...(mandanteOk ? { mandanteId: mandanteOk } : {}),
        },
        select: {
          mandanteId: true,
          numeroMandante: true,
          importBatch: { select: { perimetro: true } },
        },
      });
      numeri = numeriMandantePerFiltroPerimetro(
        mandanti,
        perimetroOk,
        mandanteOk,
        scope.map((p) => ({
          mandanteId: p.mandanteId,
          numeroMandante: p.numeroMandante,
          importBatchPerimetro: p.importBatch?.perimetro ?? null,
        }))
      );
    }
  }

  const praticaWhere = praticaMonitorWhere(
    user.tenantId,
    mandanteOk,
    perimetroOk,
    perimetroOk ? numeri : undefined
  );

  return incassiGuadagnoAnnoOperatore(user, {
    operatoreId,
    year: anno,
    praticaWhere,
  });
}
