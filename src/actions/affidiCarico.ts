"use server";

import { requirePermission } from "@/lib/guard";
import { incassiGuadagnoAnnoOperatore } from "@/lib/affidi/incassiGuadagnoAnnoOperatore";
import { praticaMonitorWhere } from "@/lib/affidi/loadAffidiMonitoraggio";

export async function loadIncassiGuadagnoAnnoOperatoreAction(params: {
  operatoreId: string;
  anno: number;
  caricoMandato?: string;
  caricoPerimetro?: string;
}) {
  const user = await requirePermission("pratiche:assign");
  const operatoreId = params.operatoreId?.trim();
  if (!operatoreId) throw new Error("Operatore mancante");

  const anno = Number(params.anno);
  if (!Number.isFinite(anno) || anno < 2000 || anno > 2100) {
    throw new Error("Anno non valido");
  }

  const praticaWhere = praticaMonitorWhere(
    user.tenantId,
    params.caricoMandato,
    params.caricoPerimetro
  );

  return incassiGuadagnoAnnoOperatore(user, {
    operatoreId,
    year: anno,
    praticaWhere,
  });
}
