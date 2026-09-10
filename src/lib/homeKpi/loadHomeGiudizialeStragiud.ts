import "server-only";
import { praticaDbFromUser } from "@/lib/praticheRepo";
import { praticaScopeWhere } from "@/lib/gruppoPerimetroScope";
import {
  PREAVVISO_STRAGIUDIZIALE_GG_LAVORATIVI,
  PREAVVISO_STRAGIUDIZIALE_PARAM,
  wherePreavvisoStragiudiziale,
} from "@/lib/scadenzaStragiudiziale";
import {
  ATTIVITA_GIUDIZIALE_PARAM,
  whereAttivitaGiudiziale,
} from "@/lib/giudiziale/avvioGiudiziale";
import { can, type SessionUser } from "@/lib/permissions";

export type HomeGiudizialeStragiudKpi = {
  preavvisoCount: number;
  preavvisoGgLavorativi: number;
  preavvisoHref: string;
  attivitaGiudizialeCount: number;
  attivitaGiudizialeHref: string;
};

export async function loadHomeGiudizialeStragiudKpi(
  user: SessionUser
): Promise<HomeGiudizialeStragiudKpi> {
  const preavvisoHref = `/pratiche?${PREAVVISO_STRAGIUDIZIALE_PARAM}=1`;
  const attivitaGiudizialeHref = can(user, "legal:view")
    ? "/legal"
    : `/pratiche?${ATTIVITA_GIUDIZIALE_PARAM}=1`;

  const empty: HomeGiudizialeStragiudKpi = {
    preavvisoCount: 0,
    preavvisoGgLavorativi: PREAVVISO_STRAGIUDIZIALE_GG_LAVORATIVI,
    preavvisoHref,
    attivitaGiudizialeCount: 0,
    attivitaGiudizialeHref,
  };

  if (user.role === "MANUTENZIONE") return empty;

  const baseScope = await praticaScopeWhere(user);
  const db = praticaDbFromUser(user);

  const [preavvisoCount, attivitaGiudizialeCount] = await Promise.all([
    db.count({
      where: { AND: [baseScope, wherePreavvisoStragiudiziale()] },
    }),
    db.count({
      where: { AND: [baseScope, whereAttivitaGiudiziale()] },
    }),
  ]);

  return {
    preavvisoCount,
    preavvisoGgLavorativi: PREAVVISO_STRAGIUDIZIALE_GG_LAVORATIVI,
    preavvisoHref,
    attivitaGiudizialeCount,
    attivitaGiudizialeHref,
  };
}
