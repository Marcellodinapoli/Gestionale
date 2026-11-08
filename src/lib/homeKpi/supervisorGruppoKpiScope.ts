import "server-only";
import type { Prisma } from "@prisma/client";
import { nessunDatoWhere } from "@/lib/domain";
import type { GruppoMandanteAssegnazione } from "@/lib/gruppoMandanti";
import { gruppoLavoroPraticaWhere } from "@/lib/gruppoLavoro";
import type { GruppoPerimetroContext } from "@/lib/gruppoPerimetroScope";
import { gruppoPerimetroScopeWhere } from "@/lib/codiciMandantePerimetro";
import type { HomeScopeFilter } from "@/lib/data/contracts/dashboard";
import type { SessionUser } from "@/lib/permissions";
import { resolvePerimetroOr } from "@/lib/homeKpi/resolvePerimetroOr";

/** Scope SQL Home KPI supervisor: pratiche affidate ai membri del gruppo (perimetro se configurato). */
export async function supervisorHomeKpiScopeFilter(
  user: SessionUser,
  periCtx: GruppoPerimetroContext
): Promise<HomeScopeFilter> {
  if (!periCtx.nelGruppo || !periCtx.memberIds.length) {
    return { mode: "none" };
  }
  const base: HomeScopeFilter = {
    mode: "members",
    memberIds: periCtx.memberIds,
  };
  if (periCtx.nessunPerimetroGruppo) return base;
  const perimetroOr = await resolvePerimetroOr(user.tenantId, periCtx.gruppoMandanti);
  if (!perimetroOr?.length) return base;
  return { ...base, perimetroOr };
}

/** Scope Prisma per conteggi card Home (supervisor: portafoglio aggregato del gruppo). */
export async function supervisorHomePraticaCountWhere(
  user: SessionUser,
  memberIds: string[],
  gruppoMandanti: GruppoMandanteAssegnazione[]
): Promise<Prisma.PraticaWhereInput> {
  if (!memberIds.length) return nessunDatoWhere();
  const portfolio = gruppoLavoroPraticaWhere(memberIds);
  if (!gruppoMandanti.length) {
    return { AND: [{ tenantId: user.tenantId }, portfolio] };
  }
  const scope = await gruppoPerimetroScopeWhere(user.tenantId, gruppoMandanti);
  if (!scope) {
    return { AND: [{ tenantId: user.tenantId }, portfolio] };
  }
  return {
    AND: [{ tenantId: user.tenantId }, portfolio, scope],
  };
}
