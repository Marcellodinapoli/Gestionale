import { cache } from "react";
import type { Prisma } from "@prisma/client";
import { nessunDatoWhere, praticaWhere } from "@/lib/domain";
import { getGruppoLavoro } from "@/lib/gruppoLavoro";
import {
  gruppoPerimetroScopeWhere,
  type GruppoPerimetroOpts,
} from "@/lib/codiciMandantePerimetro";
import { prisma } from "@/lib/prisma";
import { praticaDbFromUser } from "@/lib/praticheRepo";
import type { GruppoMandanteAssegnazione } from "@/lib/gruppoMandanti";
import { isManutenzione, type SessionUser } from "@/lib/permissions";

export type GruppoPerimetroContext = {
  /** Operatore/supervisor in un gruppo con supervisor configurato. */
  nelGruppo: boolean;
  /** Gruppo senza mandanti/perimetri configurati. */
  nessunPerimetroGruppo: boolean;
  gruppoMandanti: GruppoMandanteAssegnazione[];
  periScope: Prisma.PraticaWhereInput | null;
  memberIds: string[];
};

const emptyCtx: GruppoPerimetroContext = {
  nelGruppo: false,
  nessunPerimetroGruppo: false,
  gruppoMandanti: [],
  periScope: null,
  memberIds: [],
};

/** Contesto perimetri del gruppo (cache per richiesta — una sola risoluzione). */
export const resolveGruppoPerimetroContext = cache(
  async function resolveGruppoPerimetroContext(
    user: SessionUser
  ): Promise<GruppoPerimetroContext> {
  if (isManutenzione(user)) return emptyCtx;
  if (user.role !== "OPERATOR" && user.role !== "SUPERVISOR") return emptyCtx;

  const gruppo = await getGruppoLavoro(user);
  const nelGruppo =
    Boolean(gruppo.supervisorId) &&
    gruppo.members.some((m) => m.role === "SUPERVISOR");

  if (!nelGruppo) return emptyCtx;

  if (!gruppo.gruppoMandanti.length) {
    return {
      nelGruppo: true,
      nessunPerimetroGruppo: true,
      gruppoMandanti: [],
      periScope: null,
      memberIds: gruppo.memberIds,
    };
  }

  const periScope = await gruppoPerimetroScopeWhere(user.tenantId, gruppo.gruppoMandanti);
  if (!periScope) {
    return {
      nelGruppo: true,
      nessunPerimetroGruppo: true,
      gruppoMandanti: gruppo.gruppoMandanti,
      periScope: null,
      memberIds: gruppo.memberIds,
    };
  }

  return {
    nelGruppo: true,
    nessunPerimetroGruppo: false,
    gruppoMandanti: gruppo.gruppoMandanti,
    periScope,
    memberIds: gruppo.memberIds,
  };
  }
);

/** Contesto perimetri da un gruppo già risolto (es. back office con scelta supervisor). */
export async function buildGruppoPerimetroContextFromGruppo(
  tenantId: string,
  gruppo: Awaited<ReturnType<typeof getGruppoLavoro>>
): Promise<GruppoPerimetroContext> {
  const nelGruppo =
    Boolean(gruppo.supervisorId) &&
    gruppo.members.some((m) => m.role === "SUPERVISOR");

  if (!nelGruppo) return emptyCtx;

  if (!gruppo.gruppoMandanti.length) {
    return {
      nelGruppo: true,
      nessunPerimetroGruppo: true,
      gruppoMandanti: [],
      periScope: null,
      memberIds: gruppo.memberIds,
    };
  }

  const periScope = await gruppoPerimetroScopeWhere(tenantId, gruppo.gruppoMandanti);
  if (!periScope) {
    return {
      nelGruppo: true,
      nessunPerimetroGruppo: true,
      gruppoMandanti: gruppo.gruppoMandanti,
      periScope: null,
      memberIds: gruppo.memberIds,
    };
  }

  return {
    nelGruppo: true,
    nessunPerimetroGruppo: false,
    gruppoMandanti: gruppo.gruppoMandanti,
    periScope,
    memberIds: gruppo.memberIds,
  };
}

/** Scope pratiche per tenant + perimetri gruppo (back office). */
export async function praticaScopeForGruppoContext(
  tenantId: string,
  ctx: GruppoPerimetroContext
): Promise<Prisma.PraticaWhereInput> {
  const base: Prisma.PraticaWhereInput = { tenantId };
  if (!ctx.nelGruppo) return base;
  if (ctx.nessunPerimetroGruppo) return nessunDatoWhere();
  return { AND: [base, ctx.periScope!] };
}

/** Base where pratiche: visibilità ruolo + perimetri gruppo (se applicabile). */
export async function praticaScopeWhere(user: SessionUser): Promise<Prisma.PraticaWhereInput> {
  const ctx = await resolveGruppoPerimetroContext(user);
  const base = praticaWhere(user);
  if (!ctx.nelGruppo) return base;
  // Gruppo senza perimetri: non azzerare l’elenco (bloccherebbe anche ricerche);
  // resta lo scope ruolo (portfolio). Avviso UI in pagina Pratiche / Affidi.
  if (ctx.nessunPerimetroGruppo) return base;
  return { AND: [base, ctx.periScope!] };
}

/**
 * Scope F1 / ricerca pratica: tutte le pratiche del tenant.
 * Nessun vincolo di assegnatario, perimetro gruppo, stato o scadenza stragiudiziale
 * (a differenza della coda operativa). Usato da ricerca anagrafica in elenco
 * Pratiche e da /api/pratiche-cerca.
 */
export async function praticaCercaScopeWhere(
  user: SessionUser
): Promise<Prisma.PraticaWhereInput> {
  if (isManutenzione(user)) return nessunDatoWhere();
  return { tenantId: user.tenantId };
}

export function gruppoPerimetroOptsFromContext(
  ctx: GruppoPerimetroContext
): GruppoPerimetroOpts | undefined {
  if (!ctx.nelGruppo) return undefined;
  return { gruppoMandanti: ctx.gruppoMandanti };
}

/** Filtra un elenco di id pratica al perimetro di gruppo (se attivo). */
export async function filtraIdsPraticaScope(
  user: SessionUser,
  ids: string[] | null
): Promise<string[] | null> {
  if (!ids?.length) return ids;
  const ctx = await resolveGruppoPerimetroContext(user);
  if (!ctx.nelGruppo) return ids;
  if (ctx.nessunPerimetroGruppo) return [];
  const scope = await praticaScopeWhere(user);
  const praticaModel = praticaDbFromUser(user);
  const allowed = await praticaModel.findMany({
    where: { AND: [scope, { id: { in: ids } }] },
    select: { id: true },
  });
  return allowed.map((p) => p.id);
}
