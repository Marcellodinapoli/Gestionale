import "server-only";
import type { HomeKpiBundle, HomeKpiContext } from "@/lib/data/contracts/dashboard";
import { getDashboardRepository, isSqlBackendProvider } from "@/lib/data/factory";
import {
  codiciPerMandantePerimetro,
  codiciPerMandantePerimetroPerOperatore,
  daAffidarePerPerimetroGruppo,
  inLavorazionePerPerimetro,
} from "@/lib/codiciMandantePerimetro";
import { loadFirestoreHomeKpi } from "@/lib/homeKpi/firestoreHomeKpi";
import {
  applicaCambiCodicePerOperatore,
  completaOperatoriGruppo,
  lavoratePerOperatoreInGiornata,
  praticheConCambioCodiceInGiornata,
  praticheLavorateInGiornata,
} from "@/lib/lavorateOggi";
import { isManutenzione } from "@/lib/permissions";

export async function loadHomeKpi(
  ctx: HomeKpiContext,
  firestoreLoader: () => Promise<HomeKpiBundle>
): Promise<HomeKpiBundle> {
  if (!isSqlBackendProvider()) return firestoreLoader();
  return getDashboardRepository().getHomeKpi(ctx);
}

export async function loadHomeKpiAuto(
  ctx: HomeKpiContext,
  deps: Parameters<typeof loadFirestoreHomeKpi>[1]
): Promise<HomeKpiBundle> {
  const bundle = await loadHomeKpi(ctx, () => loadFirestoreHomeKpi(ctx, deps));

  const useGruppoPortfolio =
    (deps.user.role === "SUPERVISOR" || deps.user.role === "BACK_OFFICE") &&
    deps.mostraGruppo &&
    !isManutenzione(deps.user);

  const gruppoOpts = useGruppoPortfolio
    ? { portfolioMemberIds: deps.gruppo.memberIds }
    : deps.gruppoPerimetroOpts;

  if (useGruppoPortfolio) {
    const [codiciMandantePerimetro, inLavoroPerPerimetro, codiciMandantePerimetroOperatore] =
      await Promise.all([
        codiciPerMandantePerimetro(deps.user, gruppoOpts),
        inLavorazionePerPerimetro(deps.user, gruppoOpts),
        codiciPerMandantePerimetroPerOperatore(
          deps.user,
          gruppoOpts,
          deps.gruppo.members
        ),
      ]);
    bundle.shared.codiciMandantePerimetro = codiciMandantePerimetro;
    bundle.shared.inLavoroPerPerimetro = inLavoroPerPerimetro;
    bundle.shared.codiciMandantePerimetroOperatore = codiciMandantePerimetroOperatore;
  }

  if (!isSqlBackendProvider() || isManutenzione(deps.user)) {
    return bundle;
  }

  if (!useGruppoPortfolio) {
    const [codiciMandantePerimetro, inLavoroPerPerimetro] = await Promise.all([
      codiciPerMandantePerimetro(deps.user, gruppoOpts ?? undefined),
      inLavorazionePerPerimetro(deps.user, gruppoOpts ?? undefined),
    ]);
    bundle.shared.codiciMandantePerimetro = codiciMandantePerimetro;
    bundle.shared.inLavoroPerPerimetro = inLavoroPerPerimetro;
    bundle.shared.codiciMandantePerimetroOperatore = [];
  }

  if (deps.user.role === "SUPERVISOR" && deps.mostraGruppo) {
    bundle.shared.daAffidareGruppo = await daAffidarePerPerimetroGruppo(
      deps.user.tenantId,
      deps.gruppo.gruppoMandanti,
      deps.user.tenantSlug ?? deps.user.tenantId,
    );
  }

  const lavorateOpts = { data: deps.dataLavorate, scopeWhere: deps.where };

  if (deps.vistaGruppoLavorate) {
    const [lavorateRaw, praticheLavorateGruppo, cambiRaw] = await Promise.all([
      lavoratePerOperatoreInGiornata(deps.user, lavorateOpts),
      praticheLavorateInGiornata(deps.user, lavorateOpts),
      praticheConCambioCodiceInGiornata(deps.user, lavorateOpts),
    ]);
    bundle.shared.lavoratePerOperatore = applicaCambiCodicePerOperatore(
      completaOperatoriGruppo(lavorateRaw, deps.gruppo.members),
      cambiRaw
    );
    bundle.shared.praticheLavorateGruppo = praticheLavorateGruppo;
    bundle.shared.praticheCambioCodice = cambiRaw;
  } else if (deps.user.role === "OPERATOR") {
    const [lavorateRaw, cambiRaw] = await Promise.all([
      lavoratePerOperatoreInGiornata(deps.user, lavorateOpts),
      praticheConCambioCodiceInGiornata(deps.user, lavorateOpts),
    ]);
    bundle.shared.lavoratePerOperatore = applicaCambiCodicePerOperatore(
      lavorateRaw,
      cambiRaw
    );
    bundle.shared.praticheCambioCodice = cambiRaw;
  }

  return bundle;
}
