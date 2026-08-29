import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/guard";
import { can, isManutenzione } from "@/lib/permissions";
import { euro, dataIt, nessunDatoWhere } from "@/lib/domain";
import {
  formatDataIso,
  isOggi,
  lavoratePerOperatoreInGiornata,
  praticheLavorateInGiornata,
  praticheConCambioCodiceInGiornata,
  parseDataIso,
  startOfToday,
  completaOperatoriGruppo,
  applicaCambiCodicePerOperatore,
} from "@/lib/lavorateOggi";
import {
  praticaScopeWhere,
  resolveGruppoPerimetroContext,
  gruppoPerimetroOptsFromContext,
  buildGruppoPerimetroContextFromGruppo,
  praticaScopeForGruppoContext,
} from "@/lib/gruppoPerimetroScope";
import { PageHeader } from "@/components/ui";
import { esitoContattoLabel } from "@/lib/contatto";
import { metodoIncassoLabel } from "@/lib/metodoIncasso";
import { buildPraticheQuery } from "@/components/PaginazioneBar";
import { getGruppoLavoro, getGruppoLavoroForSupervisor } from "@/lib/gruppoLavoro";
import { DashboardKpi } from "@/components/home/DashboardStat";
import { MissingSedeBanner, RicaviAltreSediNascostiBanner } from "@/components/sedi/MissingSedeBanner";
import { SedeRendimentoFilter } from "@/components/sedi/SedeRendimentoFilter";
import { sedeScopeForRendimento, canViewRicaviFatturatiSede } from "@/lib/sedeScope";
import { GruppoLavoroHomeCard } from "@/components/home/GruppoLavoroHomeCard";
import { FormazioneMonitorHomeCard } from "@/components/home/FormazioneMonitorHomeCard";
import { HomeGruppoPicker } from "@/components/home/HomeGruppoPicker";
import { LavorateGiornoKpi } from "@/components/home/LavorateGiornoKpi";
import { CodiciMandantePerimetroTable } from "@/components/home/CodiciMandantePerimetroTable";
import { InLavorazionePerimetroCard } from "@/components/home/InLavorazionePerimetroCard";
import { DaAffidarePerimetroCard } from "@/components/home/DaAffidarePerimetroCard";
import { IncassiTipologiaFiltri } from "@/components/home/IncassiTipologiaFiltri";
import { parsePerimetri } from "@/lib/mandantePerimetri";
import {
  codiciPerMandantePerimetro,
  daAffidarePerPerimetroGruppo,
  inLavorazionePerPerimetro,
} from "@/lib/codiciMandantePerimetro";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prismaCount } from "@/lib/prismaCount";

type RiepilogoMandante = {
  id: string;
  codice: string;
  ragioneSociale: string;
  pratiche: number;
  affidato: number;
  incassato: number;
  percentuale: number;
};

async function riepilogoMandanti(
  tenantId: string,
  sedeId?: string | null
): Promise<RiepilogoMandante[]> {
  const praticheWhere: Prisma.PraticaWhereInput = {
    tenantId,
    ...(sedeId
      ? {
          OR: [
            { assegnatario: { sedeId } },
            { operatoreTitolare: { sedeId } },
          ],
        }
      : {}),
  };

  const [mandanti, pratiche] = await Promise.all([
    prisma.mandante.findMany({
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
  ]);

  const byMandante = new Map<
    string,
    { n: number; affidato: number; incassato: number }
  >();
  for (const p of pratiche) {
    const cur = byMandante.get(p.mandanteId) || { n: 0, affidato: 0, incassato: 0 };
    cur.n += 1;
    cur.affidato += (p.capitale || 0) + (p.interessi || 0) + (p.spese || 0);
    cur.incassato += p.incassi.reduce((s, i) => s + (i.importo || 0), 0);
    byMandante.set(p.mandanteId, cur);
  }

  return mandanti.map((m) => {
    const agg = byMandante.get(m.id) || { n: 0, affidato: 0, incassato: 0 };
    return {
      id: m.id,
      codice: m.codice,
      ragioneSociale: m.ragioneSociale,
      pratiche: agg.n,
      affidato: agg.affidato,
      incassato: agg.incassato,
      percentuale: agg.affidato > 0 ? (agg.incassato / agg.affidato) * 100 : 0,
    };
  });
}

function RiepilogoMandantiTable({
  righe,
  mostraTotali = true,
}: {
  righe: RiepilogoMandante[];
  mostraTotali?: boolean;
}) {
  const totAffidato = righe.reduce((s, r) => s + r.affidato, 0);
  const totIncassato = righe.reduce((s, r) => s + r.incassato, 0);
  const totPerc = totAffidato > 0 ? (totIncassato / totAffidato) * 100 : 0;

  return (
    <div>
      <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
        Riepilogo per mandante
      </h2>
      <div className="overflow-x-auto rounded-xl border border-[var(--line)] bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-[var(--muted)]">
            <tr>
              <th className="px-3 py-2">Codice</th>
              <th>Mandante</th>
              <th className="text-right">Pratiche</th>
              {mostraTotali ? (
                <>
                  <th className="text-right">Affidato</th>
                  <th className="text-right">Incassato</th>
                  <th className="text-right">% Recupero</th>
                </>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {righe.map((r) => (
              <tr key={r.id} className="border-t border-[var(--line)]">
                <td className="px-3 py-2 font-medium">
                  <Link href={`/mandanti/${r.id}`} className="text-[var(--accent)] underline">
                    {r.codice}
                  </Link>
                </td>
                <td>{r.ragioneSociale}</td>
                <td className="text-right">{r.pratiche}</td>
                {mostraTotali ? (
                  <>
                    <td className="text-right">{euro(r.affidato)}</td>
                    <td className="text-right font-semibold">{euro(r.incassato)}</td>
                    <td className="text-right">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                          r.percentuale >= 50
                            ? "bg-emerald-100 text-emerald-800"
                            : r.percentuale >= 20
                              ? "bg-amber-100 text-amber-800"
                              : "bg-red-100 text-red-800"
                        }`}
                      >
                        {r.percentuale.toFixed(1)}%
                      </span>
                    </td>
                  </>
                ) : null}
              </tr>
            ))}
            {mostraTotali ? (
              <tr className="border-t-2 border-[var(--navy)] bg-slate-50 font-semibold">
                <td className="px-3 py-2" colSpan={2}>
                  Totale
                </td>
                <td className="text-right">{righe.reduce((s, r) => s + r.pratiche, 0)}</td>
                <td className="text-right">{euro(totAffidato)}</td>
                <td className="text-right">{euro(totIncassato)}</td>
                <td className="text-right">
                  <span className="inline-flex rounded-full bg-[var(--navy)] px-2 py-0.5 text-xs text-white">
                    {totPerc.toFixed(1)}%
                  </span>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{
    lavorateData?: string;
    incMandante?: string;
    incPerimetro?: string;
    gruppo?: string;
    sede?: string;
  }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const {
    lavorateData: lavorateDataRaw,
    incMandante,
    incPerimetro,
    gruppo: gruppoRaw,
    sede: sedeRaw,
  } = sp;
  const dataLavorate = parseDataIso(lavorateDataRaw) ?? startOfToday();
  const dataIso = formatDataIso(dataLavorate);

  const isBackOfficeGruppo = user.role === "BACK_OFFICE" && !isManutenzione(user);
  const supervisoriHome = isBackOfficeGruppo
    ? await prisma.user.findMany({
        where: { tenantId: user.tenantId, role: "SUPERVISOR", active: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true, gruppoNome: true },
      })
    : [];

  let gruppo = await getGruppoLavoro(user);
  let periCtx = await resolveGruppoPerimetroContext(user);
  let where = await praticaScopeWhere(user);

  const targetSupervisorId =
    isBackOfficeGruppo && supervisoriHome.length
      ? supervisoriHome.some((s) => s.id === gruppoRaw)
        ? gruppoRaw!
        : supervisoriHome[0]!.id
      : null;

  if (isBackOfficeGruppo && targetSupervisorId) {
    gruppo = await getGruppoLavoroForSupervisor(user.tenantId, targetSupervisorId);
    periCtx = await buildGruppoPerimetroContextFromGruppo(user.tenantId, gruppo);
    where = await praticaScopeForGruppoContext(user.tenantId, periCtx);
  }

  const mostraGruppo =
    !isManutenzione(user) &&
    Boolean(gruppo.supervisorName) &&
    gruppo.members.some((m) => m.role === "SUPERVISOR") &&
    (user.role === "OPERATOR" ||
      user.role === "SUPERVISOR" ||
      user.role === "BACK_OFFICE");

  const gruppoPerimetroOpts =
    gruppoPerimetroOptsFromContext(periCtx) ??
    (mostraGruppo ? { gruppoMandanti: gruppo.gruppoMandanti } : undefined);
  const gruppoPerimetriConfigurati = periCtx.nelGruppo
    ? !periCtx.nessunPerimetroGruppo
    : gruppo.gruppoMandanti.length > 0;
  const vistaGruppoLavorate =
    user.role === "SUPERVISOR" || user.role === "BACK_OFFICE";
  const lavorateOpts = { data: dataLavorate, scopeWhere: where };

  const [totali, inLavoroPerPerimetro, scadute, incassiOggi, lavoratePerOperatoreRaw, praticheLavorateGruppo, praticheCambioCodice, codiciMandantePerimetro, daAffidareGruppo] =
    await Promise.all([
      prisma.pratica.count({ where }),
      inLavorazionePerPerimetro(user, gruppoPerimetroOpts),
      prisma.pratica.count({
        where: {
          ...where,
          scadenza: { lte: new Date() },
          stato: { notIn: ["INCASSO", "RESA", "INESIGIBILE"] },
        },
      }),
      prisma.incasso.aggregate({
        _sum: { importo: true },
        where: isManutenzione(user)
          ? nessunDatoWhere()
          : can(user, "incassi:create") || can(user, "report:view")
            ? { data: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } }
            : { userId: user.id, data: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
      }),
      lavoratePerOperatoreInGiornata(user, lavorateOpts),
      vistaGruppoLavorate
        ? praticheLavorateInGiornata(user, lavorateOpts)
        : Promise.resolve([]),
      praticheConCambioCodiceInGiornata(user, lavorateOpts),
      isManutenzione(user)
        ? Promise.resolve([])
        : codiciPerMandantePerimetro(user, gruppoPerimetroOpts),
      mostraGruppo && !isManutenzione(user)
        ? daAffidarePerPerimetroGruppo(user.tenantId, gruppo.gruppoMandanti)
        : Promise.resolve([]),
    ]);

  const lavoratePerOperatore = applicaCambiCodicePerOperatore(
    vistaGruppoLavorate
      ? completaOperatoriGruppo(lavoratePerOperatoreRaw, gruppo.members)
      : lavoratePerOperatoreRaw,
    praticheCambioCodice
  );

  if (user.role === "AMMINISTRAZIONE") {
    const { sedeId: sedeFiltro } = sedeScopeForRendimento(user, sedeRaw);
    const mostraRicavi = canViewRicaviFatturatiSede(user, sedeFiltro || user.sedeId || null);
    // Contatori operativi: tutte le sedi (o filtro sede se scelto).
    // Ricavi/provvigioni: solo propria sede.
    const oggi = new Date();
    oggi.setHours(0, 0, 0, 0);
    const inizioMese = new Date(oggi.getFullYear(), oggi.getMonth(), 1);
    const sedeOps = sedeFiltro || undefined;
    const sedeRicavi = user.sedeId || undefined;
    const sediOpts = await prisma.sede.findMany({
      where: { tenantId: user.tenantId, active: true },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true },
    });
    const [
      totPratiche,
      provvigioniMese,
      provvigioniDaLiquidare,
      mandantiCount,
      operatoriCount,
    ] = await Promise.all([
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
        ? prisma.provvigione.aggregate({
            _sum: { importo: true },
            where: {
              createdAt: { gte: inizioMese },
              pratica: { tenantId: user.tenantId },
              operatore: { sedeId: sedeRicavi },
            },
          })
        : Promise.resolve({ _sum: { importo: null as number | null } }),
      sedeRicavi
        ? prisma.provvigione.aggregate({
            _sum: { importo: true },
            where: {
              stato: "MATURATA",
              pratica: { tenantId: user.tenantId },
              operatore: { sedeId: sedeRicavi },
            },
          })
        : Promise.resolve({ _sum: { importo: null as number | null } }),
      prisma.mandante.count({ where: { tenantId: user.tenantId } }),
      prisma.user.count({
        where: {
          tenantId: user.tenantId,
          role: { in: ["OPERATOR", "SUPERVISOR"] },
          active: true,
          ...(sedeOps ? { sedeId: sedeOps } : {}),
        },
      }),
    ]);

    return (
      <div className="space-y-5 pb-8">
        <PageHeader
          title="Home"
          subtitle="Amministrazione · tutte le sedi (ricavi solo sede propria)"
        />

        <SedeRendimentoFilter
          sedi={sediOpts}
          sedeId={sedeFiltro}
          basePath="/"
          keepParams={{
            lavorateData: lavorateDataRaw,
            incMandante,
            incPerimetro,
            gruppo: gruppoRaw,
          }}
        />

        {!user.sedeId ? <MissingSedeBanner /> : null}
        {user.sedeId && sedeFiltro && sedeFiltro !== user.sedeId ? (
          <RicaviAltreSediNascostiBanner sedeNomePropria={user.sedeNome} />
        ) : null}

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:gap-3">
          {mostraRicavi && sedeRicavi ? (
            <>
              <DashboardKpi
                title="Provvigioni mese (tua sede)"
                value={euro(provvigioniMese._sum.importo || 0)}
              />
              <DashboardKpi
                title="Provv. da liquidare (tua sede)"
                value={euro(provvigioniDaLiquidare._sum.importo || 0)}
                hint="Totale maturate non ancora erogate"
              />
            </>
          ) : (
            <>
              <DashboardKpi title="Provvigioni mese" value="—" hint="Solo sulla tua sede" />
              <DashboardKpi title="Provv. da liquidare" value="—" hint="Solo sulla tua sede" />
            </>
          )}
          <DashboardKpi title="Pratiche totali" value={totPratiche} />
          <DashboardKpi title="Provvigioni" value="Dettaglio" href="/provigioni" />
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:gap-3">
          <DashboardKpi title="Mandanti" value={mandantiCount} href="/mandanti" />
          <DashboardKpi title="Operatori attivi" value={operatoriCount} href="/operatori" />
        </div>
      </div>
    );
  }

  if (user.role === "ADMIN") {
    const oggi = new Date();
    oggi.setHours(0, 0, 0, 0);

    const { sedeId: sedeScopeId } = sedeScopeForRendimento(user, sedeRaw);
    const sediOpts = await prisma.sede.findMany({
      where: { tenantId: user.tenantId, active: true },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true },
    });
    const sedePraticaWhere: Prisma.PraticaWhereInput | undefined = sedeScopeId
      ? {
          OR: [
            { assegnatario: { sedeId: sedeScopeId } },
            { operatoreTitolare: { sedeId: sedeScopeId } },
          ],
        }
      : undefined;
    const sedeUserFilter = sedeScopeId ? { sedeId: sedeScopeId } : {};

    const [operatoriCountAdmin] = await Promise.all([
      prisma.user.count({
        where: {
          tenantId: user.tenantId,
          role: { in: ["OPERATOR", "SUPERVISOR"] },
          active: true,
          ...sedeUserFilter,
        },
      }),
    ]);

    const mandantiRiepilogo = await riepilogoMandanti(user.tenantId, sedeScopeId);
    const totAffidato = mandantiRiepilogo.reduce((s, r) => s + r.affidato, 0);
    const totIncassato = mandantiRiepilogo.reduce((s, r) => s + r.incassato, 0);
    const totPerc = totAffidato > 0 ? (totIncassato / totAffidato) * 100 : 0;

    const inizioMese = new Date(oggi.getFullYear(), oggi.getMonth(), 1);

    const mandantiFiltro = await prisma.mandante.findMany({
      where: { tenantId: user.tenantId },
      orderBy: { codice: "asc" },
      select: { id: true, codice: true, ragioneSociale: true, perimetri: true },
    });

    const lottiPerMandante = await prisma.pratica.groupBy({
      by: ["mandanteId", "numeroMandante"],
      where: {
        tenantId: user.tenantId,
        numeroMandante: { not: null },
      },
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
      return {
        id: m.id,
        codice: m.codice,
        ragioneSociale: m.ragioneSociale,
        perimetri,
      };
    });

    const mandanteFiltroOk =
      incMandante && mandantiFiltriUi.some((m) => m.id === incMandante)
        ? incMandante
        : undefined;
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
      ...(sedePraticaWhere ? sedePraticaWhere : {}),
    };
    const incassoWhereBase: Prisma.IncassoWhereInput = {
      pratica: praticaIncassoFilter,
    };

    const [incassiPerMetodo, incassiPerMetodoMese] = await Promise.all([
      prisma.incasso.groupBy({
        by: ["metodo"],
        where: incassoWhereBase,
        _sum: { importo: true },
        _count: true,
      }),
      prisma.incasso.groupBy({
        by: ["metodo"],
        where: { ...incassoWhereBase, data: { gte: inizioMese } },
        _sum: { importo: true },
        _count: true,
      }),
    ]);
    const totImportoMetodi = incassiPerMetodo.reduce(
      (s, r) => s + (r._sum.importo || 0),
      0
    );
    const tipologieIncasso = incassiPerMetodo
      .map((r) => ({
        metodo: r.metodo,
        label: metodoIncassoLabel(r.metodo),
        pezzi: prismaCount(r._count),
        importo: r._sum.importo || 0,
        perc: totImportoMetodi > 0 ? ((r._sum.importo || 0) / totImportoMetodi) * 100 : 0,
        meseImporto:
          incassiPerMetodoMese.find((m) => m.metodo === r.metodo)?._sum.importo || 0,
        mesePezzi: prismaCount(
          incassiPerMetodoMese.find((m) => m.metodo === r.metodo)?._count
        ),
      }))
      .sort((a, b) => b.importo - a.importo);

    // Produttività operatori (attività oggi)
    const inizioOggi = new Date(oggi);
    const fineOggi = new Date(oggi);
    fineOggi.setHours(23, 59, 59, 999);
    const attivitaPerOperatore = await prisma.attivita.groupBy({
      by: ["userId"],
      where: { createdAt: { gte: inizioOggi, lte: fineOggi } },
      _count: true,
    });
    const operatoriAttivi = await prisma.user.findMany({
      where: {
        tenantId: user.tenantId,
        role: { in: ["OPERATOR", "SUPERVISOR"] },
        active: true,
        ...sedeUserFilter,
      },
      select: { id: true, name: true, supervisorId: true },
      orderBy: { name: "asc" },
    });
    const produttivita = operatoriAttivi.map((o) => ({
      name: o.name,
      attivita: prismaCount(attivitaPerOperatore.find((a) => a.userId === o.id)?._count),
    }));

    // Distribuzione carico per gruppo
    const supervisori = await prisma.user.findMany({
      where: {
        tenantId: user.tenantId,
        role: "SUPERVISOR",
        active: true,
        ...sedeUserFilter,
      },
      select: { id: true, name: true, gruppoNome: true },
      orderBy: { name: "asc" },
    });
    const caricoGruppi = await Promise.all(
      supervisori.map(async (s) => {
        const memberIds = [
          s.id,
          ...(
            await prisma.user.findMany({
              where: {
                tenantId: user.tenantId,
                supervisorId: s.id,
                active: true,
                ...sedeUserFilter,
              },
              select: { id: true },
            })
          ).map((u) => u.id),
        ];
        const [aperte, totali] = await Promise.all([
          prisma.pratica.count({
            where: {
              assegnatarioId: { in: memberIds },
              stato: { notIn: ["INCASSO", "RESA", "INESIGIBILE"] },
              ...(sedePraticaWhere || {}),
            },
          }),
          prisma.pratica.count({
            where: {
              assegnatarioId: { in: memberIds },
              ...(sedePraticaWhere || {}),
            },
          }),
        ]);
        return {
          nome: s.gruppoNome || s.name,
          aperte,
          totali,
          membri: memberIds.length,
        };
      })
    );

    // Esiti contatto
    const esitiContatto = await prisma.pratica.groupBy({
      by: ["esitoContatto"],
      where: {
        tenantId: user.tenantId,
        esitoContatto: { not: null },
        ...(sedePraticaWhere || {}),
      },
      _count: true,
    });
    const totEsiti = esitiContatto.reduce((s, e) => s + prismaCount(e._count), 0);

    // Pratiche in scadenza (prossimi 7 giorni)
    const tra7gg = new Date(oggi);
    tra7gg.setDate(tra7gg.getDate() + 7);
    const [scadute, inScadenza7gg, nonAssegnate] = await Promise.all([
      prisma.pratica.count({
        where: {
          tenantId: user.tenantId,
          scadenza: { lt: oggi },
          stato: { notIn: ["INCASSO", "RESA", "INESIGIBILE"] },
          ...(sedePraticaWhere || {}),
        },
      }),
      prisma.pratica.count({
        where: {
          tenantId: user.tenantId,
          scadenza: { gte: oggi, lte: tra7gg },
          stato: { notIn: ["INCASSO", "RESA", "INESIGIBILE"] },
          ...(sedePraticaWhere || {}),
        },
      }),
      prisma.pratica.count({
        where: {
          tenantId: user.tenantId,
          assegnatarioId: null,
          stato: { notIn: ["INCASSO", "RESA", "INESIGIBILE"] },
          ...(sedePraticaWhere || {}),
        },
      }),
    ]);

    // Incassi per mandante ultimi 6 mesi
    const mesiIndietro = 6;
    const daIncassi = new Date(oggi.getFullYear(), oggi.getMonth() - (mesiIndietro - 1), 1);
    const aIncassi = new Date(oggi.getFullYear(), oggi.getMonth() + 1, 0, 23, 59, 59, 999);
    const [mandantiAttivi, incassiRows] = await Promise.all([
      prisma.mandante.findMany({
        where: { tenantId: user.tenantId },
        orderBy: { codice: "asc" },
        select: { id: true, codice: true },
      }),
      prisma.incasso.findMany({
        where: {
          data: { gte: daIncassi, lte: aIncassi },
          pratica: {
            tenantId: user.tenantId,
            ...(sedePraticaWhere || {}),
          },
        },
        include: {
          pratica: { select: { mandanteId: true } },
        },
      }),
    ]);
    const sumsByMonthMandante = new Map<string, number>();
    for (const row of incassiRows) {
      const d = row.data instanceof Date ? row.data : new Date(row.data);
      if (Number.isNaN(d.getTime())) continue;
      const key = `${d.getFullYear()}-${d.getMonth()}|${row.pratica.mandanteId}`;
      sumsByMonthMandante.set(key, (sumsByMonthMandante.get(key) || 0) + (row.importo || 0));
    }
    const incassiPerMandanteMese: Array<{
      mese: string;
      mandanti: Array<{ codice: string; importo: number }>;
      totale: number;
    }> = [];
    for (let i = mesiIndietro - 1; i >= 0; i--) {
      const da = new Date(oggi.getFullYear(), oggi.getMonth() - i, 1);
      const mandantiMese: Array<{ codice: string; importo: number }> = [];
      let totaleMese = 0;
      for (const m of mandantiAttivi) {
        const imp = sumsByMonthMandante.get(`${da.getFullYear()}-${da.getMonth()}|${m.id}`) || 0;
        mandantiMese.push({ codice: m.codice, importo: imp });
        totaleMese += imp;
      }
      incassiPerMandanteMese.push({
        mese: da.toLocaleDateString("it-IT", { month: "short", year: "2-digit" }),
        mandanti: mandantiMese,
        totale: totaleMese,
      });
    }
    const maxMese = Math.max(...incassiPerMandanteMese.map((m) => m.totale), 1);
    const colori = ["#2563eb", "#16a34a", "#d97706", "#dc2626", "#7c3aed", "#0891b2", "#be185d", "#65a30d"];

    const sedeNomeAttiva = sedeScopeId
      ? sediOpts.find((s) => s.id === sedeScopeId)?.nome
      : null;

    return (
      <div className="space-y-5 pb-8">
        <PageHeader
          title="Home"
          subtitle={
            sedeNomeAttiva
              ? `Amministratore · sede ${sedeNomeAttiva}`
              : "Pannello di controllo amministratore azienda"
          }
        />

        <SedeRendimentoFilter
          sedi={sediOpts}
          sedeId={sedeScopeId}
          basePath="/"
          keepParams={{
            lavorateData: lavorateDataRaw,
            incMandante,
            incPerimetro,
            gruppo: gruppoRaw,
          }}
        />

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:gap-3">
          <DashboardKpi title="Totale affidato" value={euro(totAffidato)} />
          <DashboardKpi title="Totale incassato" value={euro(totIncassato)} />
          <DashboardKpi
            title="% Recupero"
            value={`${totPerc.toFixed(1)}%`}
          />
          <DashboardKpi title="Operatori attivi" value={operatoriCountAdmin} href="/operatori" />
        </div>

        {/* Incassi per tipologia */}
        <div>
          <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
            Incassi per tipologia
          </h2>
          <div className="rounded-xl border border-[var(--line)] bg-white p-4">
            <Suspense fallback={null}>
              <IncassiTipologiaFiltri
                mandanti={mandantiFiltriUi}
                mandanteId={mandanteFiltroOk}
                perimetro={perimetroFiltroOk}
                sedeId={sedeScopeId}
              />
            </Suspense>
            {tipologieIncasso.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">
                Nessun incasso{mandanteFiltroOk || perimetroFiltroOk ? " con i filtri selezionati" : " registrato"}.
              </p>
            ) : (
              <>
                <div className="mb-4 space-y-2">
                  {tipologieIncasso.map((t) => (
                    <div key={t.metodo} className="flex items-center gap-2">
                      <span className="w-44 truncate text-xs font-medium">{t.label}</span>
                      <div className="flex-1 rounded-full bg-slate-100" style={{ height: 14 }}>
                        <div
                          className="h-full rounded-full bg-emerald-600"
                          style={{
                            width: `${t.perc}%`,
                            minWidth: t.importo > 0 ? 8 : 0,
                          }}
                        />
                      </div>
                      <span className="w-24 text-right text-xs font-semibold">
                        {euro(t.importo)}
                      </span>
                      <span className="w-12 text-right text-[10px] text-[var(--muted)]">
                        {t.perc.toFixed(0)}%
                      </span>
                    </div>
                  ))}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-[var(--muted)]">
                      <tr>
                        <th className="py-1.5">Tipologia</th>
                        <th className="text-right">Pezzi</th>
                        <th className="text-right">Importo totale</th>
                        <th className="text-right">% sul totale</th>
                        <th className="text-right">Mese corrente</th>
                        <th className="text-right">Pezzi mese</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tipologieIncasso.map((t) => (
                        <tr key={t.metodo} className="border-t border-[var(--line)]">
                          <td className="py-1.5 font-medium">{t.label}</td>
                          <td className="text-right">{t.pezzi}</td>
                          <td className="text-right font-semibold">{euro(t.importo)}</td>
                          <td className="text-right text-[var(--muted)]">
                            {t.perc.toFixed(1)}%
                          </td>
                          <td className="text-right">{euro(t.meseImporto)}</td>
                          <td className="text-right text-[var(--muted)]">{t.mesePezzi}</td>
                        </tr>
                      ))}
                      <tr className="border-t-2 border-[var(--navy)] font-semibold">
                        <td className="py-1.5">Totale</td>
                        <td className="text-right">
                          {tipologieIncasso.reduce((s, t) => s + t.pezzi, 0)}
                        </td>
                        <td className="text-right">{euro(totImportoMetodi)}</td>
                        <td className="text-right">100%</td>
                        <td className="text-right">
                          {euro(tipologieIncasso.reduce((s, t) => s + t.meseImporto, 0))}
                        </td>
                        <td className="text-right">
                          {tipologieIncasso.reduce((s, t) => s + t.mesePezzi, 0)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Grafico incassi per mandante */}
        <div>
          <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
            Andamento incassi per mandante — ultimi {mesiIndietro} mesi
          </h2>
          <div className="rounded-xl border border-[var(--line)] bg-white p-4">
            <div className="mb-3 flex flex-wrap gap-3">
              {mandantiAttivi.map((m, i) => (
                <span key={m.id} className="flex items-center gap-1.5 text-[10px]">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: colori[i % colori.length] }}
                  />
                  {m.codice}
                </span>
              ))}
            </div>
            <div className="flex items-end gap-3" style={{ height: 200 }}>
              {incassiPerMandanteMese.map((mese, mi) => (
                <div key={mi} className="flex flex-1 flex-col items-center gap-1">
                  <span className="text-[9px] font-semibold text-[var(--navy)]">
                    {euro(mese.totale)}
                  </span>
                  <div className="flex w-full flex-col-reverse">
                    {mese.mandanti.map((m, idx) => {
                      const h = mese.totale > 0
                        ? Math.max((m.importo / maxMese) * 160, m.importo > 0 ? 3 : 0)
                        : 0;
                      return (
                        <div
                          key={idx}
                          className={idx === mese.mandanti.length - 1 ? "rounded-t" : ""}
                          style={{
                            height: h,
                            backgroundColor: colori[idx % colori.length],
                          }}
                          title={`${m.codice}: ${euro(m.importo)}`}
                        />
                      );
                    })}
                  </div>
                  <span className="text-[10px] text-[var(--muted)]">{mese.mese}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <RiepilogoMandantiTable righe={mandantiRiepilogo} />

        {/* Allerte */}
        <div>
          <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
            Allerte
          </h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:gap-3">
            <DashboardKpi
              title="Scadute"
              value={scadute}
              hint="Pratiche oltre la scadenza"
            />
            <DashboardKpi
              title="In scadenza 7 gg"
              value={inScadenza7gg}
              hint="Scadono entro una settimana"
            />
            <DashboardKpi
              title="Non assegnate"
              value={nonAssegnate}
              hint="Pratiche aperte senza operatore"
            />
          </div>
        </div>

        {/* Produttività operatori oggi */}
        <div>
          <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
            Produttività operatori — oggi
          </h2>
          <div className="rounded-xl border border-[var(--line)] bg-white p-4">
            {produttivita.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">Nessun operatore attivo.</p>
            ) : (
              <div className="space-y-1.5">
                {(() => {
                  const maxAtt = Math.max(...produttivita.map((p) => p.attivita), 1);
                  return produttivita.map((p, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="w-32 truncate text-xs font-medium">{p.name}</span>
                      <div className="flex-1 rounded-full bg-slate-100" style={{ height: 14 }}>
                        <div
                          className="h-full rounded-full bg-[var(--accent)]"
                          style={{ width: `${(p.attivita / maxAtt) * 100}%`, minWidth: p.attivita > 0 ? 8 : 0 }}
                        />
                      </div>
                      <span className="w-8 text-right text-xs font-semibold">{p.attivita}</span>
                    </div>
                  ));
                })()}
              </div>
            )}
          </div>
        </div>

        {/* Carico per gruppo */}
        <div>
          <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
            Distribuzione carico per gruppo
          </h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {caricoGruppi.map((g, i) => (
              <div key={i} className="rounded-xl border border-[var(--line)] bg-white p-3">
                <p className="text-xs font-bold text-[var(--navy)]">{g.nome}</p>
                <p className="mt-1 text-[10px] text-[var(--muted)]">{g.membri} membri</p>
                <div className="mt-2 flex gap-4">
                  <div>
                    <p className="text-lg font-semibold text-amber-600">{g.aperte}</p>
                    <p className="text-[9px] text-[var(--muted)]">Aperte</p>
                  </div>
                  <div>
                    <p className="text-lg font-semibold">{g.totali}</p>
                    <p className="text-[9px] text-[var(--muted)]">Totali</p>
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-[var(--accent)]">
                      {g.totali > 0 ? `${((g.totali - g.aperte) / g.totali * 100).toFixed(0)}%` : "—"}
                    </p>
                    <p className="text-[9px] text-[var(--muted)]">Chiuse</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Esiti contatto */}
        <div>
          <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
            Esiti contatto
          </h2>
          <div className="rounded-xl border border-[var(--line)] bg-white p-4">
            {esitiContatto.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">Nessun esito registrato.</p>
            ) : (
              <div className="space-y-1.5">
                {esitiContatto
                  .map((e) => ({ ...e, n: prismaCount(e._count) }))
                  .sort((a, b) => b.n - a.n)
                  .map((e, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="w-36 truncate text-xs font-medium">
                        {esitoContattoLabel(e.esitoContatto || "")}
                      </span>
                      <div className="flex-1 rounded-full bg-slate-100" style={{ height: 14 }}>
                        <div
                          className="h-full rounded-full bg-[#1a365d]"
                          style={{
                            width: `${totEsiti ? (e.n / totEsiti) * 100 : 0}%`,
                            minWidth: 8,
                          }}
                        />
                      </div>
                      <span className="w-12 text-right text-[10px] text-[var(--muted)]">
                        {e.n} ({totEsiti ? ((e.n / totEsiti) * 100).toFixed(0) : 0}%)
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:gap-3">
          <DashboardKpi title="Mandanti" value={mandantiAttivi.length} href="/mandanti" />
          <DashboardKpi title="Pratiche" value={mandantiRiepilogo.reduce((s, r) => s + r.pratiche, 0)} href="/pratiche" />
          <DashboardKpi title="Configurazione" value="⚙" href="/configurazione" />
        </div>
      </div>
    );
  }

  const subtitle =
    user.role === "MANUTENZIONE"
      ? "Struttura del gestionale · nessun dato operativo"
      : user.role === "OPERATOR"
        ? gruppo.supervisorName
          ? `La tua coda · Gruppo di ${gruppo.supervisorName}`
          : "La tua coda di lavorazione"
        : user.role === "SUPERVISOR"
          ? "Portafoglio del team e affidi"
          : user.role === "BACK_OFFICE"
            ? gruppo.gruppoNome
              ? `Monitoraggio gruppo · ${gruppo.gruppoNome}`
              : "Monitoraggio gruppi di lavoro"
            : "Controllo complessivo delle pratiche";

  const dataLabel = dataIt(dataLavorate);
  const totaleLavorateGruppo = vistaGruppoLavorate
    ? praticheLavorateGruppo.length
    : lavoratePerOperatore.reduce((s, o) => s + o.count, 0);
  const hintGiorno = vistaGruppoLavorate
    ? totaleLavorateGruppo
      ? `${gruppo.gruppoNome || "Gruppo"} · ${dataLabel} · ${totaleLavorateGruppo === 1 ? "1 pratica lavorata in totale dal gruppo" : `${totaleLavorateGruppo} pratiche lavorate in totale dal gruppo`}`
      : `${gruppo.gruppoNome || "Gruppo"} · ${dataLabel} · nessuna lavorazione nel gruppo`
    : totaleLavorateGruppo
      ? `${dataLabel} · ${totaleLavorateGruppo === 1 ? "1 pratica lavorata" : `${totaleLavorateGruppo} pratiche lavorate`}`
    : `${dataLabel} · nessuna lavorazione`;
  const titoloLavorate = isOggi(dataLavorate)
    ? vistaGruppoLavorate
      ? "Lavorate oggi · gruppo"
      : "Lavorate oggi"
    : vistaGruppoLavorate
      ? "Lavorate · gruppo"
      : "Lavorate";

  return (
    <div className="space-y-5 pb-8">
      <PageHeader title="Home" subtitle={subtitle} />

      {isBackOfficeGruppo && supervisoriHome.length && targetSupervisorId ? (
        <HomeGruppoPicker
          supervisori={supervisoriHome}
          gruppoId={targetSupervisorId}
          lavorateData={lavorateDataRaw}
        />
      ) : null}

      <div
        className={`grid grid-cols-2 gap-2 lg:gap-3 ${
          mostraGruppo ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-3"
        }`}
      >
        <DashboardKpi title="Pratiche visibili" value={totali} />
        <InLavorazionePerimetroCard
          righe={inLavoroPerPerimetro}
          gruppoSenzaPerimetri={mostraGruppo && !gruppoPerimetriConfigurati}
        />
        {mostraGruppo ? (
          <DaAffidarePerimetroCard
            righe={daAffidareGruppo}
            canAssign={can(user, "pratiche:assign")}
            gruppoConfigurato={gruppoPerimetriConfigurati}
          />
        ) : null}
        <DashboardKpi
          title={can(user, "incassi:create") ? "Incassi oggi" : "Scadute"}
          value={
            can(user, "incassi:create")
              ? euro(incassiOggi._sum.importo || 0)
              : scadute
          }
        />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,3fr)] lg:gap-3">
        <div>
          <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
            Sintesi lavorazione
          </h2>
        <LavorateGiornoKpi
          title={titoloLavorate}
          hint={hintGiorno}
          dataIso={dataIso}
          operatori={lavoratePerOperatore}
            praticheCambioCodice={praticheCambioCodice}
          href={buildPraticheQuery({ lavorateData: dataIso })}
            vistaGruppo={vistaGruppoLavorate}
            totaleLavorateGruppo={vistaGruppoLavorate ? totaleLavorateGruppo : undefined}
        />
      </div>

        {!isManutenzione(user) ? (
          <div className="min-w-0">
        <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
              Codici scarico per mandante e perimetro
        </h2>
            <CodiciMandantePerimetroTable
              righe={codiciMandantePerimetro}
              gruppoSenzaPerimetri={mostraGruppo && !gruppoPerimetriConfigurati}
            />
        </div>
        ) : null}
      </div>

      {mostraGruppo ? (
        <GruppoLavoroHomeCard
          gruppo={gruppo}
          currentUserId={user.id}
          canManage={user.role === "SUPERVISOR" || user.role === "BACK_OFFICE"}
        />
      ) : null}

      {user.role === "SUPERVISOR" ? <FormazioneMonitorHomeCard /> : null}

    </div>
  );
}
