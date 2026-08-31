import "server-only";
import { nessunDatoWhere } from "@/lib/domain";
import { getGruppoLavoro } from "@/lib/gruppoLavoro";
import { mandantiDb } from "@/lib/mandantiRepo";
import { parsePerimetriList } from "@/lib/mandantePerimetri";
import { gruppoMandantiPraticaWhere } from "@/lib/gruppoMandanti";
import { resolveGruppoPerimetroContext } from "@/lib/gruppoPerimetroScope";
import { isManutenzione, type SessionUser } from "@/lib/permissions";
import type { HomeScopeFilter } from "@/lib/data/contracts/dashboard";
import type { AgendaScopeContext } from "@/lib/data/contracts/agenda";

async function resolvePerimetroOr(
  tenantId: string,
  tenantSlug: string,
  gruppoMandanti: Array<{ mandanteId: string; perimetriIds: string[] }>
): Promise<HomeScopeFilter["perimetroOr"]> {
  if (!gruppoMandanti.length) return undefined;
  const mandantiRows = await mandantiDb({ tenantId, tenantSlug }).findMany({
    where: { tenantId, id: { in: [...new Set(gruppoMandanti.map((a) => a.mandanteId))] } },
    select: { id: true, perimetri: true },
  });
  const mandanti = mandantiRows.map((m) => ({
    id: m.id as string,
    perimetri: parsePerimetriList(m.perimetri),
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

export async function buildAgendaScopeContext(user: SessionUser): Promise<AgendaScopeContext> {
  const tenantSlug = user.tenantSlug ?? user.tenantId;
  const periCtx = await resolveGruppoPerimetroContext(user);
  const gruppo = await getGruppoLavoro(user);

  let scope: HomeScopeFilter = { mode: "tenant" };

  if (isManutenzione(user)) {
    scope = { mode: "none" };
  } else if (user.role === "OPERATOR") {
    scope = {
      mode: "operator",
      userId: user.id,
      perimetroOr: periCtx.nelGruppo
        ? await resolvePerimetroOr(user.tenantId, tenantSlug, periCtx.gruppoMandanti)
        : undefined,
    };
    if (periCtx.nelGruppo && periCtx.nessunPerimetroGruppo) scope = { mode: "none" };
  } else if (user.role === "SUPERVISOR") {
    scope = {
      mode: "supervisor",
      userId: user.id,
      perimetroOr: periCtx.nelGruppo
        ? await resolvePerimetroOr(user.tenantId, tenantSlug, periCtx.gruppoMandanti)
        : undefined,
    };
    if (periCtx.nelGruppo && periCtx.nessunPerimetroGruppo) scope = { mode: "none" };
  } else if (user.role === "BACK_OFFICE" && periCtx.nelGruppo) {
    if (periCtx.nessunPerimetroGruppo) scope = { mode: "none" };
    else {
      scope = {
        mode: "tenant",
        perimetroOr: await resolvePerimetroOr(user.tenantId, tenantSlug, periCtx.gruppoMandanti),
      };
    }
  }

  void nessunDatoWhere;

  return {
    tenantSlug,
    tenantId: user.tenantId,
    role: user.role,
    userId: user.id,
    memberIds: gruppo.memberIds,
    scope,
  };
}
