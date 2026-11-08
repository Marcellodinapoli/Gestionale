import "server-only";
import { can, isManutenzione, type SessionUser } from "@/lib/permissions";
import { nessunDatoWhere } from "@/lib/domain";
import type { GruppoPerimetroContext } from "@/lib/gruppoPerimetroScope";
import type { GruppoLavoro } from "@/lib/gruppoLavoro";
import type { HomeKpiContext, HomeScopeFilter } from "@/lib/data/contracts/dashboard";
import { resolvePerimetroOr } from "@/lib/homeKpi/resolvePerimetroOr";
import { supervisorHomeKpiScopeFilter } from "@/lib/homeKpi/supervisorGruppoKpiScope";

export { resolvePerimetroOr } from "@/lib/homeKpi/resolvePerimetroOr";
import { formatDataIso, parseDataIso, startOfToday } from "@/lib/lavorateOggiUi";
import { sedeScopeForRendimento, canViewRicaviFatturatiSede } from "@/lib/sedeScope";

export type HomeSearchParams = {
  lavorateData?: string;
  incMandante?: string;
  incPerimetro?: string;
  incMese?: string;
  produttivita?: string;
  gruppo?: string;
  sede?: string;
};

export async function buildHomeKpiContext(
  user: SessionUser,
  sp: HomeSearchParams,
  opts: {
    gruppo: GruppoLavoro;
    periCtx: GruppoPerimetroContext;
    targetSupervisorId?: string | null;
  }
): Promise<HomeKpiContext> {
  const dataLavorate = parseDataIso(sp.lavorateData) ?? startOfToday();
  const lavorateDate = formatDataIso(dataLavorate);

  const mostraGruppo =
    !isManutenzione(user) &&
    Boolean(opts.gruppo.supervisorName) &&
    opts.gruppo.members.some((m) => m.role === "SUPERVISOR") &&
    (user.role === "OPERATOR" || user.role === "SUPERVISOR" || user.role === "BACK_OFFICE");

  const vistaGruppoLavorate = user.role === "SUPERVISOR" || user.role === "BACK_OFFICE";
  const { sedeId: sedeScopeId } = sedeScopeForRendimento(user, sp.sede);

  let scope: HomeScopeFilter = { mode: "tenant" };

  if (isManutenzione(user)) {
    scope = { mode: "none" };
  } else if (user.role === "OPERATOR") {
    const perimetroOr =
      opts.periCtx.nelGruppo && !opts.periCtx.nessunPerimetroGruppo
        ? await resolvePerimetroOr(user.tenantId, opts.periCtx.gruppoMandanti)
        : undefined;
    scope = {
      mode: "operator",
      userId: user.id,
      perimetroOr,
    };
  } else if (user.role === "SUPERVISOR") {
    scope = await supervisorHomeKpiScopeFilter(user, opts.periCtx);
    if (scope.mode === "none" && !opts.periCtx.nelGruppo) {
      scope = { mode: "supervisor", userId: user.id };
    }
  } else if (user.role === "BACK_OFFICE" && opts.targetSupervisorId && opts.periCtx.nelGruppo) {
    if (opts.periCtx.nessunPerimetroGruppo) scope = { mode: "none" };
    else {
      scope = {
        mode: "tenant",
        perimetroOr: await resolvePerimetroOr(user.tenantId, opts.periCtx.gruppoMandanti),
      };
    }
  } else {
    scope = { mode: "tenant", sedeId: sedeScopeId || undefined };
  }

  void nessunDatoWhere;

  let incassiScope: HomeKpiContext["incassiScope"] = "tenant";
  if (isManutenzione(user)) incassiScope = "none";
  else if (!can(user, "incassi:create") && !can(user, "report:view")) incassiScope = "user";

  const { mostraRicavi, sedeRicavi } = amministrazioneRicaviFlags(user, sedeScopeId);

  return {
    tenantSlug: user.tenantSlug ?? user.tenantId,
    tenantId: user.tenantId,
    role: user.role,
    userId: user.id,
    sedeScopeId,
    lavorateDate,
    incMandante: sp.incMandante,
    incPerimetro: sp.incPerimetro,
    incMese: sp.incMese,
    includeProduttivita: sp.produttivita === "1",
    scope,
    incassiScope,
    includeAdmin: user.role === "ADMIN",
    includeAmministrazione: user.role === "AMMINISTRAZIONE",
    vistaGruppoLavorate,
    mostraGruppo,
    gruppoMandanti: mostraGruppo ? opts.gruppo.gruppoMandanti : undefined,
    memberIds: opts.gruppo.memberIds,
    sedeRicaviId: sedeRicavi,
    mostraRicavi,
  };
}

export function amministrazioneRicaviFlags(
  user: SessionUser,
  sedeFiltro: string | null | undefined
) {
  return {
    mostraRicavi: canViewRicaviFatturatiSede(user, sedeFiltro || user.sedeId || null),
    sedeRicavi: user.sedeId || undefined,
  };
}
