import "server-only";
import { praticaDbFromUser } from "@/lib/praticheRepo";
import { praticaScopeWhere } from "@/lib/gruppoPerimetroScope";
import {
  PREAVVISO_STRAGIUDIZIALE_GG_LAVORATIVI,
  wherePreavvisoStragiudiziale,
} from "@/lib/scadenzaStragiudiziale";
import type { SessionUser } from "@/lib/permissions";

export type PreavvisoStragiudizialeSummary = {
  count: number;
  ggLavorativi: number;
  listHref: string;
};

export async function loadPreavvisoStragiudizialeSummary(
  user: SessionUser
): Promise<PreavvisoStragiudizialeSummary> {
  const listHref = `/pratiche?preavvisoStragiudiziale=1`;
  const empty: PreavvisoStragiudizialeSummary = {
    count: 0,
    ggLavorativi: PREAVVISO_STRAGIUDIZIALE_GG_LAVORATIVI,
    listHref,
  };

  if (user.role === "MANUTENZIONE") return empty;

  const baseScope = await praticaScopeWhere(user);
  const where = {
    AND: [baseScope, wherePreavvisoStragiudiziale()],
  };

  const count = await praticaDbFromUser(user).count({ where });
  return {
    count,
    ggLavorativi: PREAVVISO_STRAGIUDIZIALE_GG_LAVORATIVI,
    listHref,
  };
}
