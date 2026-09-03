import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { mandantiDb, mandantiDbFromUser } from "@/lib/mandantiRepo";
import { sediDbFromUser } from "@/lib/sediRepo";
import { usersDbFromUser } from "@/lib/usersRepo";
import { incassiDbFromUser } from "@/lib/incassiRepo";
import { provvigioniDbFromUser } from "@/lib/provvigioniRepo";
import { can, isManutenzione, type SessionUser } from "@/lib/permissions";
import { nessunDatoWhere } from "@/lib/domain";
import {
  applicaCambiCodicePerOperatore,
  completaOperatoriGruppo,
  lavoratePerOperatoreInGiornata,
  praticheConCambioCodiceInGiornata,
  praticheLavorateInGiornata,
} from "@/lib/lavorateOggi";
import {
  codiciPerMandantePerimetro,
  daAffidarePerPerimetroGruppo,
  inLavorazionePerPerimetro,
} from "@/lib/codiciMandantePerimetro";
import {
  gruppoPerimetroOptsFromContext,
  type GruppoPerimetroContext,
} from "@/lib/gruppoPerimetroScope";
import type { GruppoLavoro } from "@/lib/gruppoLavoro";
import type { HomeKpiBundle, HomeKpiContext } from "@/lib/data/contracts/dashboard";
import { amministrazioneRicaviFlags } from "@/lib/homeKpi/buildContext";
import { parsePerimetri } from "@/lib/mandantePerimetri";
import { prismaCount } from "@/lib/prismaCount";
import { rangeMeseIncassi } from "@/lib/incassiMeseFiltro";

export type FirestoreHomeDeps = {
  user: SessionUser;
  where: Prisma.PraticaWhereInput;
  gruppo: GruppoLavoro;
  periCtx: GruppoPerimetroContext;
  mostraGruppo: boolean;
  vistaGruppoLavorate: boolean;
  gruppoPerimetroOpts: ReturnType<typeof gruppoPerimetroOptsFromContext>;
  dataLavorate: Date;
  sedeScopeId?: string | null;
  incMandante?: string;
  incPerimetro?: string;
};

async function riepilogoMandantiFirestore(tenantId: string, sedeId?: string | null) {
  const praticheWhere: Prisma.PraticaWhereInput = {
    tenantId,
    ...(sedeId
      ? { OR: [{ assegnatario: { sedeId } }, { operatoreTitolare: { sedeId } }] }
      : {}),
  };
  const mandantiModel = mandantiDb({ tenantId, tenantSlug: tenantId });
  const [mandanti, pratiche, provvigioni] = await Promise.all([
    mandantiModel.findMany({
      where: { tenantId },
      select: { id: true, codice: true, ragioneSociale: true },
      orderBy: { codice: "asc" },
    }),
    prisma.pratica.findMany({
      where: praticheWhere,
      select: {
        mandanteId: true,
        capitale: true,
        interessi: true,
        spese: true,
        incassi: { select: { importo: true } },
      },
    }),
    prisma.provvigione.findMany({
      where: {
        pratica: praticheWhere,
      },
      select: {
        importo: true,
        pratica: { select: { mandanteId: true } },
      },
    }),
  ]);
  const byMandante = new Map<
    string,
    { n: number; affidato: number; incassato: number; ricavoLordo: number }
  >();
  for (const p of pratiche) {
    const cur = byMandante.get(p.mandanteId) || {
      n: 0,
      affidato: 0,
      incassato: 0,
      ricavoLordo: 0,
    };
    cur.n += 1;
    cur.affidato += (p.capitale || 0) + (p.interessi || 0) + (p.spese || 0);
    cur.incassato += p.incassi.reduce((s, i) => s + (i.importo || 0), 0);
    byMandante.set(p.mandanteId, cur);
  }
  for (const pv of provvigioni) {
    const mid = pv.pratica.mandanteId;
    const cur = byMandante.get(mid) || { n: 0, affidato: 0, incassato: 0, ricavoLordo: 0 };
    cur.ricavoLordo += pv.importo || 0;
    byMandante.set(mid, cur);
  }
  return mandanti.map((m) => {
    const agg = byMandante.get(m.id) || { n: 0, affidato: 0, incassato: 0, ricavoLordo: 0 };
    return {
      id: m.id,
      codice: m.codice,
      ragioneSociale: m.ragioneSociale,
      pratiche: agg.n,
      affidato: agg.affidato,
      incassato: agg.incassato,
      ricavoLordo: agg.ricavoLordo,
      percentuale: agg.affidato > 0 ? (agg.incassato / agg.affidato) * 100 : 0,
    };
  });
}

export async function loadFirestoreHomeKpi(
  ctx: HomeKpiContext,
  deps: FirestoreHomeDeps
): Promise<HomeKpiBundle> {
  const start = performance.now();
  const {
    user,
    where,
    gruppo,
    mostraGruppo,
    vistaGruppoLavorate,
    gruppoPerimetroOpts,
    dataLavorate,
    sedeScopeId,
    incMandante,
    incPerimetro,
  } = deps;

  const lavorateOpts = { data: dataLavorate, scopeWhere: where };

  const [
    totali,
    inLavoroPerPerimetro,
    scadute,
    incassiOggi,
    lavoratePerOperatoreRaw,
    praticheLavorateGruppo,
    praticheCambioCodice,
    codiciMandantePerimetro,
    daAffidareGruppo,
  ] = await Promise.all([
    prisma.pratica.count({ where }),
    inLavorazionePerPerimetro(user, gruppoPerimetroOpts ?? undefined),
    prisma.pratica.count({
      where: {
        ...where,
        scadenza: { lte: new Date() },
        stato: { notIn: ["INCASSO", "RESA", "INESIGIBILE"] },
      },
    }),
    incassiDbFromUser(user).aggregate({
      _sum: { importo: true },
      where: isManutenzione(user)
        ? nessunDatoWhere()
        : can(user, "incassi:create") || can(user, "report:view")
          ? { data: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } }
          : { userId: user.id, data: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
    }),
    lavoratePerOperatoreInGiornata(user, lavorateOpts),
    vistaGruppoLavorate ? praticheLavorateInGiornata(user, lavorateOpts) : Promise.resolve([]),
    praticheConCambioCodiceInGiornata(user, lavorateOpts),
    isManutenzione(user) ? Promise.resolve([]) : codiciPerMandantePerimetro(user, gruppoPerimetroOpts ?? undefined),
    mostraGruppo && !isManutenzione(user)
      ? daAffidarePerPerimetroGruppo(user.tenantId, gruppo.gruppoMandanti, user.tenantSlug ?? user.tenantId)
      : Promise.resolve([]),
  ]);

  const lavoratePerOperatore = applicaCambiCodicePerOperatore(
    vistaGruppoLavorate
      ? completaOperatoriGruppo(lavoratePerOperatoreRaw, gruppo.members)
      : lavoratePerOperatoreRaw,
    praticheCambioCodice
  );

  const bundle: HomeKpiBundle = {
    shared: {
      totali,
      scadute,
      incassiOggiSum: incassiOggi._sum.importo || 0,
      inLavoroPerPerimetro,
      lavoratePerOperatore,
      praticheLavorateGruppo,
      praticheCambioCodice,
      codiciMandantePerimetro,
      daAffidareGruppo,
    },
    meta: { queryMs: 0, sqlQueries: 0, roundTrips: 0 },
  };

  if (ctx.includeAmministrazione) {
    const oggi = new Date();
    oggi.setHours(0, 0, 0, 0);
    const inizioMese = new Date(oggi.getFullYear(), oggi.getMonth(), 1);
    const sedeOps = sedeScopeId || undefined;
    const { mostraRicavi, sedeRicavi } = amministrazioneRicaviFlags(user, sedeScopeId);

    const sediOpts = await sediDbFromUser(user).findMany({
      where: { tenantId: user.tenantId, active: true },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true },
    });

    const [totPratiche, provvigioniMese, provvigioniDaLiquidare, mandantiCount, operatoriCount] =
      await Promise.all([
        prisma.pratica.count({
          where: {
            tenantId: user.tenantId,
            ...(sedeOps
              ? {
                  OR: [
                    { assegnatario: { sedeId: sedeOps } },
                    { operatoreTitolare: { sedeId: sedeOps } },
                  ],
                }
              : {}),
          },
        }),
        sedeRicavi
          ? provvigioniDbFromUser(user).aggregate({
              _sum: { importo: true },
              where: {
                createdAt: { gte: inizioMese },
                pratica: { tenantId: user.tenantId },
                operatore: { sedeId: sedeRicavi },
              },
            })
          : Promise.resolve({ _sum: { importo: null as number | null } }),
        sedeRicavi
          ? provvigioniDbFromUser(user).aggregate({
              _sum: { importo: true },
              where: {
                stato: "MATURATA",
                pratica: { tenantId: user.tenantId },
                operatore: { sedeId: sedeRicavi },
              },
            })
          : Promise.resolve({ _sum: { importo: null as number | null } }),
        mandantiDbFromUser(user).count({ where: { tenantId: user.tenantId } }),
        usersDbFromUser(user).count({
          where: {
            tenantId: user.tenantId,
            role: { in: ["OPERATOR", "SUPERVISOR"] },
            active: true,
            ...(sedeOps ? { sedeId: sedeOps } : {}),
          },
        }),
      ]);

    bundle.amministrazione = {
      sediOpts,
      totPratiche,
      provvigioniMeseSum: mostraRicavi ? provvigioniMese._sum.importo : null,
      provvigioniDaLiquidareSum: mostraRicavi ? provvigioniDaLiquidare._sum.importo : null,
      mandantiCount,
      operatoriCount,
      mostraRicavi: Boolean(mostraRicavi && sedeRicavi),
      sedeFiltro: sedeScopeId,
    };
  }

  if (ctx.includeAdmin) {
    const oggi = new Date();
    oggi.setHours(0, 0, 0, 0);
    const { inizio: inizioMese, fine: fineMese } = rangeMeseIncassi(ctx.incMese);
    const sedePraticaWhere: Prisma.PraticaWhereInput | undefined = sedeScopeId
      ? {
          OR: [
            { assegnatario: { sedeId: sedeScopeId } },
            { operatoreTitolare: { sedeId: sedeScopeId } },
          ],
        }
      : undefined;
    const sedeUserFilter = sedeScopeId ? { sedeId: sedeScopeId } : {};

    const sediOpts = await sediDbFromUser(user).findMany({
      where: { tenantId: user.tenantId, active: true },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true },
    });

    const mandantiRiepilogo = await riepilogoMandantiFirestore(user.tenantId, sedeScopeId);
    const operatoriCountAdmin = await usersDbFromUser(user).count({
      where: {
        tenantId: user.tenantId,
        role: { in: ["OPERATOR", "SUPERVISOR"] },
        active: true,
        ...sedeUserFilter,
      },
    });

    const mandantiFiltro = await mandantiDbFromUser(user).findMany({
      where: { tenantId: user.tenantId },
      orderBy: { codice: "asc" },
      select: { id: true, codice: true, ragioneSociale: true, perimetri: true },
    });

    const lottiPerMandante = await prisma.pratica.groupBy({
      by: ["mandanteId", "numeroMandante"],
      where: { tenantId: user.tenantId, numeroMandante: { not: null } },
    });

    const lottiMap = new Map<string, Set<string>>();
    for (const row of lottiPerMandante) {
      const lotto = row.numeroMandante?.trim();
      if (!lotto) continue;
      const set = lottiMap.get(row.mandanteId) ?? new Set<string>();
      set.add(lotto);
      lottiMap.set(row.mandanteId, set);
    }

    const mandantiFiltriUi = mandantiFiltro.map((m) => {
      const fromConfig = parsePerimetri(m.perimetri).map((p) => p.nomeMandante);
      const fromPratiche = [...(lottiMap.get(m.id) ?? [])];
      const perimetri = [...new Set([...fromConfig, ...fromPratiche])].sort((a, b) =>
        a.localeCompare(b, "it")
      );
      return { id: m.id, codice: m.codice, ragioneSociale: m.ragioneSociale, perimetri };
    });

    const mandanteFiltroOk =
      incMandante && mandantiFiltriUi.some((m) => m.id === incMandante) ? incMandante : undefined;
    const perimetroFiltroOk = (() => {
      if (!incPerimetro?.trim()) return undefined;
      const p = incPerimetro.trim();
      if (mandanteFiltroOk) {
        const m = mandantiFiltriUi.find((x) => x.id === mandanteFiltroOk);
        return m?.perimetri.includes(p) ? p : undefined;
      }
      return mandantiFiltriUi.some((m) => m.perimetri.includes(p)) ? p : undefined;
    })();

    const praticaIncassoFilter: Prisma.PraticaWhereInput = {
      tenantId: user.tenantId,
      ...(mandanteFiltroOk ? { mandanteId: mandanteFiltroOk } : {}),
      ...(perimetroFiltroOk ? { numeroMandante: perimetroFiltroOk } : {}),
      ...(sedePraticaWhere || {}),
    };

    const [incassiPerMetodo, incassiPerMetodoMese] = await Promise.all([
      incassiDbFromUser(user).groupBy({
        by: ["metodo"],
        where: { pratica: praticaIncassoFilter },
        _sum: { importo: true },
        _count: true,
      }),
      incassiDbFromUser(user).groupBy({
        by: ["metodo"],
        where: { pratica: praticaIncassoFilter, data: { gte: inizioMese, lte: fineMese } },
        _sum: { importo: true },
        _count: true,
      }),
    ]);

    const tipologieIncasso = incassiPerMetodo
      .map((r) => ({
        metodo: r.metodo,
        pezzi: prismaCount(r._count),
        importo: r._sum.importo || 0,
        meseImporto: incassiPerMetodoMese.find((m) => m.metodo === r.metodo)?._sum.importo || 0,
        mesePezzi: prismaCount(incassiPerMetodoMese.find((m) => m.metodo === r.metodo)?._count),
      }))
      .sort((a, b) => b.importo - a.importo);

    bundle.admin = {
      sediOpts,
      operatoriCount: operatoriCountAdmin,
      mandantiRiepilogo,
      mandantiFiltriUi,
      tipologieIncasso,
      caricoGruppi: [],
      codiciScaricoRiepilogo: [],
      esitiContatto: [],
      nuove: 0,
      inLavorazione: 0,
      inScadenza7gg: 0,
      nonAssegnate: 0,
      incassiPerMandanteMese: [],
      mandantiAttivi: mandantiFiltro.map((m) => ({ id: m.id, codice: m.codice })),
    };
  }

  bundle.meta.queryMs = Math.round(performance.now() - start);
  return bundle;
}
