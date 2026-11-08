import "server-only";

import {
  codiciPerMandantePerimetro,
  codiciPerMandantePerimetroPerOperatore,
} from "@/lib/codiciMandantePerimetro";
import type { GruppoLavoro } from "@/lib/gruppoLavoro";
import {
  gruppoPerimetroOptsFromContext,
  type GruppoPerimetroContext,
} from "@/lib/gruppoPerimetroScope";
import { isManutenzione, type SessionUser } from "@/lib/permissions";
import type {
  RigaCodiciMandantePerimetro,
  RigaCodiciMandantePerimetroOperatore,
} from "@/lib/codiciMandantePerimetroUi";

/** Stessa logica della sezione codici in Home (portafoglio gruppo supervisor/back office). */
export async function loadCodiciMandantePerimetroLikeHome(
  user: SessionUser,
  deps: {
    gruppo: GruppoLavoro;
    periCtx: GruppoPerimetroContext;
    mostraGruppo: boolean;
  }
): Promise<{
  righe: RigaCodiciMandantePerimetro[];
  righePerOperatore: RigaCodiciMandantePerimetroOperatore[];
}> {
  if (isManutenzione(user)) {
    return { righe: [], righePerOperatore: [] };
  }

  const useGruppoPortfolio =
    (user.role === "SUPERVISOR" || user.role === "BACK_OFFICE") && deps.mostraGruppo;

  if (useGruppoPortfolio) {
    const gruppoOpts = { portfolioMemberIds: deps.gruppo.memberIds };
    const [righe, righePerOperatore] = await Promise.all([
      codiciPerMandantePerimetro(user, gruppoOpts),
      codiciPerMandantePerimetroPerOperatore(
        user,
        gruppoOpts,
        deps.gruppo.members
      ),
    ]);
    return { righe, righePerOperatore };
  }

  const gruppoPerimetroOpts =
    user.role === "OPERATOR"
      ? deps.periCtx.nelGruppo && !deps.periCtx.nessunPerimetroGruppo
        ? { gruppoMandanti: deps.periCtx.gruppoMandanti }
        : undefined
      : gruppoPerimetroOptsFromContext(deps.periCtx) ??
        (deps.mostraGruppo
          ? { gruppoMandanti: deps.gruppo.gruppoMandanti }
          : undefined);

  const righe = await codiciPerMandantePerimetro(
    user,
    gruppoPerimetroOpts ?? undefined
  );
  return { righe, righePerOperatore: [] };
}
