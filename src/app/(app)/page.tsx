import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/guard";
import { can, isManutenzione, STATO_LABELS } from "@/lib/permissions";
import { praticaWhere, euro, dataIt, nessunDatoWhere } from "@/lib/domain";
import {
  formatDataIso,
  isOggi,
  lavoratePerOperatoreInGiornata,
  riepilogoCodiciLavorazioneInGiornata,
  parseDataIso,
  startOfToday,
} from "@/lib/lavorateOggi";
import { PageHeader } from "@/components/ui";
import { esitoContattoLabel } from "@/lib/contatto";
import { metodoIncassoLabel } from "@/lib/metodoIncasso";
import { buildPraticheQuery } from "@/components/PaginazioneBar";
import { praticheNonToccateWhere } from "@/lib/praticheInattive";
import { getGruppoLavoro } from "@/lib/gruppoLavoro";
import { DashboardKpi, DashboardStato } from "@/components/home/DashboardStat";
import { GruppoLavoroHomeCard } from "@/components/home/GruppoLavoroHomeCard";
import { LavorateGiornoKpi } from "@/components/home/LavorateGiornoKpi";
import { IncassiTipologiaFiltri } from "@/components/home/IncassiTipologiaFiltri";
import { parsePerimetri } from "@/lib/mandantePerimetri";
import Link from "next/link";
import type { Prisma } from "@prisma/client";

type RiepilogoMandante = {
  id: string;
  codice: string;
  ragioneSociale: string;
  pratiche: number;
  affidato: number;
  incassato: number;
  percentuale: number;
};

async function riepilogoMandanti(tenantId: string): Promise<RiepilogoMandante[]> {
  const mandanti = await prisma.mandante.findMany({
    where: { tenantId },
    include: {
      pratiche: {
        select: {
          capitale: true,
          interessi: true,
          spese: true,
          incassi: { select: { importo: true } },
        },
      },
    },
    orderBy: { codice: "asc" },
  });

  return mandanti.map((m) => {
    const affidato = m.pratiche.reduce(
      (s, p) => s + (p.capitale || 0) + (p.interessi || 0) + (p.spese || 0),
      0
    );
    const incassato = m.pratiche.reduce(
      (s, p) => s + p.incassi.reduce((si, i) => si + i.importo, 0),
      0
    );
    return {
      id: m.id,
      codice: m.codice,
      ragioneSociale: m.ragioneSociale,
      pratiche: m.pratiche.length,
      affidato,
      incassato,
      percentuale: affidato > 0 ? (incassato / affidato) * 100 : 0,
    };
  });
}

function RiepilogoMandantiTable({ righe }: { righe: RiepilogoMandante[] }) {
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
              <th className="text-right">Affidato</th>
              <th className="text-right">Incassato</th>
              <th className="text-right">% Recupero</th>
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
              </tr>
            ))}
            <tr className="border-t-2 border-[var(--navy)] bg-slate-50 font-semibold">
              <td className="px-3 py-2" colSpan={2}>Totale</td>
              <td className="text-right">{righe.reduce((s, r) => s + r.pratiche, 0)}</td>
              <td className="text-right">{euro(totAffidato)}</td>
              <td className="text-right">{euro(totIncassato)}</td>
              <td className="text-right">
                <span className="inline-flex rounded-full bg-[var(--navy)] px-2 py-0.5 text-xs text-white">
                  {totPerc.toFixed(1)}%
                </span>
              </td>
            </tr>
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
  }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const { lavorateData: lavorateDataRaw, incMandante, incPerimetro } = sp;
  const dataLavorate = parseDataIso(lavorateDataRaw) ?? startOfToday();
  const dataIso = formatDataIso(dataLavorate);
  const where = praticaWhere(user);

  const [totali, nuove, inLavoro, scadute, incassiOggi, perStato, lavoratePerOperatore, codiciLavorazione, gruppo, nonToccate7, nonToccate15] =
    await Promise.all([
      prisma.pratica.count({ where }),
      prisma.pratica.count({ where: { ...where, stato: "NUOVA" } }),
      prisma.pratica.count({
        where: { ...where, stato: { in: ["AFFIDATA", "IN_LAVORAZIONE", "PROMESSA"] } },
      }),
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
      prisma.pratica.groupBy({
        by: ["stato"],
        where,
        _count: true,
      }),
      lavoratePerOperatoreInGiornata(user, { data: dataLavorate }),
      riepilogoCodiciLavorazioneInGiornata(user, { data: dataLavorate }),
      getGruppoLavoro(user),
      prisma.pratica.count({ where: { ...where, ...praticheNonToccateWhere(7) } }),
      prisma.pratica.count({ where: { ...where, ...praticheNonToccateWhere(15) } }),
    ]);

  const mostraGruppo =
    !isManutenzione(user) &&
    Boolean(gruppo.supervisorName) &&
    gruppo.members.some((m) => m.role === "SUPERVISOR") &&
    (user.role === "OPERATOR" || user.role === "SUPERVISOR");

  const conteggiStato = Object.entries(STATO_LABELS).map(([stato, label]) => ({
    stato,
    label,
    count: perStato.find((p) => p.stato === stato)?._count ?? 0,
  }));

  if (user.role === "AMMINISTRAZIONE") {
    const oggi = new Date();
    oggi.setHours(0, 0, 0, 0);
    const inizioMese = new Date(oggi.getFullYear(), oggi.getMonth(), 1);
    const [
      totPratiche,
      incassiOggiAmm,
      incassiMese,
      provvigioniMese,
      provvigioniDaLiquidare,
      mandantiCount,
      operatoriCount,
    ] = await Promise.all([
      prisma.pratica.count(),
      prisma.incasso.aggregate({
        _sum: { importo: true },
        where: { data: { gte: oggi } },
      }),
      prisma.incasso.aggregate({
        _sum: { importo: true },
        where: { data: { gte: inizioMese } },
      }),
      prisma.provvigione.aggregate({
        _sum: { importo: true },
        where: { createdAt: { gte: inizioMese } },
      }),
      prisma.provvigione.aggregate({
        _sum: { importo: true },
        where: { stato: "MATURATA" },
      }),
      prisma.mandante.count(),
      prisma.user.count({ where: { role: { in: ["OPERATOR", "SUPERVISOR"] }, active: true } }),
    ]);

    const mandantiRiepilogo = await riepilogoMandanti(user.tenantId);

    return (
      <div className="space-y-5 pb-8">
        <PageHeader title="Home" subtitle="Ufficio amministrazione · panoramica contabile" />

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:gap-3">
          <DashboardKpi title="Incassi oggi" value={euro(incassiOggiAmm._sum.importo || 0)} />
          <DashboardKpi title="Incassi mese" value={euro(incassiMese._sum.importo || 0)} />
          <DashboardKpi title="Provvigioni mese" value={euro(provvigioniMese._sum.importo || 0)} />
          <DashboardKpi
            title="Provv. da liquidare"
            value={euro(provvigioniDaLiquidare._sum.importo || 0)}
            hint="Totale maturate non ancora erogate"
          />
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:gap-3">
          <DashboardKpi title="Pratiche totali" value={totPratiche} />
          <DashboardKpi title="Mandanti" value={mandantiCount} href="/mandanti" />
          <DashboardKpi title="Operatori attivi" value={operatoriCount} href="/operatori" />
          <DashboardKpi title="Provvigioni" value="Dettaglio" href="/provigioni" />
        </div>

        <RiepilogoMandantiTable righe={mandantiRiepilogo} />
      </div>
    );
  }

  if (user.role === "ADMIN") {
    const oggi = new Date();
    oggi.setHours(0, 0, 0, 0);

    const [operatoriCountAdmin] = await Promise.all([
      prisma.user.count({ where: { role: { in: ["OPERATOR", "SUPERVISOR"] }, active: true } }),
    ]);

    const mandantiRiepilogo = await riepilogoMandanti(user.tenantId);
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
      const fromConfig = parsePerimetri(m.perimetri).map((p) => p.nome);
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
        pezzi: r._count,
        importo: r._sum.importo || 0,
        perc: totImportoMetodi > 0 ? ((r._sum.importo || 0) / totImportoMetodi) * 100 : 0,
        meseImporto:
          incassiPerMetodoMese.find((m) => m.metodo === r.metodo)?._sum.importo || 0,
        mesePezzi:
          incassiPerMetodoMese.find((m) => m.metodo === r.metodo)?._count || 0,
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
      where: { tenantId: user.tenantId, role: { in: ["OPERATOR", "SUPERVISOR"] }, active: true },
      select: { id: true, name: true, supervisorId: true },
      orderBy: { name: "asc" },
    });
    const produttivita = operatoriAttivi.map((o) => ({
      name: o.name,
      attivita: attivitaPerOperatore.find((a) => a.userId === o.id)?._count || 0,
    }));

    // Distribuzione carico per gruppo
    const supervisori = await prisma.user.findMany({
      where: { tenantId: user.tenantId, role: "SUPERVISOR", active: true },
      select: { id: true, name: true, gruppoNome: true },
      orderBy: { name: "asc" },
    });
    const caricoGruppi = await Promise.all(
      supervisori.map(async (s) => {
        const memberIds = [
          s.id,
          ...(await prisma.user.findMany({
            where: { tenantId: user.tenantId, supervisorId: s.id, active: true },
            select: { id: true },
          })).map((u) => u.id),
        ];
        const [aperte, totali] = await Promise.all([
          prisma.pratica.count({
            where: {
              assegnatarioId: { in: memberIds },
              stato: { notIn: ["INCASSO", "RESA", "INESIGIBILE"] },
            },
          }),
          prisma.pratica.count({ where: { assegnatarioId: { in: memberIds } } }),
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
      where: { esitoContatto: { not: null } },
      _count: true,
    });
    const totEsiti = esitiContatto.reduce((s, e) => s + e._count, 0);

    // Pratiche in scadenza (prossimi 7 giorni)
    const tra7gg = new Date(oggi);
    tra7gg.setDate(tra7gg.getDate() + 7);
    const [scadute, inScadenza7gg, nonAssegnate] = await Promise.all([
      prisma.pratica.count({
        where: {
          scadenza: { lt: oggi },
          stato: { notIn: ["INCASSO", "RESA", "INESIGIBILE"] },
        },
      }),
      prisma.pratica.count({
        where: {
          scadenza: { gte: oggi, lte: tra7gg },
          stato: { notIn: ["INCASSO", "RESA", "INESIGIBILE"] },
        },
      }),
      prisma.pratica.count({
        where: { assegnatarioId: null, stato: { notIn: ["INCASSO", "RESA", "INESIGIBILE"] } },
      }),
    ]);

    // Incassi per mandante ultimi 6 mesi
    const mesiIndietro = 6;
    const mandantiAttivi = await prisma.mandante.findMany({
      where: { tenantId: user.tenantId },
      orderBy: { codice: "asc" },
      select: { id: true, codice: true },
    });
    const incassiPerMandanteMese: Array<{
      mese: string;
      mandanti: Array<{ codice: string; importo: number }>;
      totale: number;
    }> = [];
    for (let i = mesiIndietro - 1; i >= 0; i--) {
      const da = new Date(oggi.getFullYear(), oggi.getMonth() - i, 1);
      const a = new Date(oggi.getFullYear(), oggi.getMonth() - i + 1, 0, 23, 59, 59, 999);
      const mandantiMese: Array<{ codice: string; importo: number }> = [];
      let totaleMese = 0;
      for (const m of mandantiAttivi) {
        const agg = await prisma.incasso.aggregate({
          _sum: { importo: true },
          where: { data: { gte: da, lte: a }, pratica: { mandanteId: m.id } },
        });
        const imp = agg._sum.importo || 0;
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

    return (
      <div className="space-y-5 pb-8">
        <PageHeader title="Home" subtitle="Pannello di controllo amministratore azienda" />

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
                  .sort((a, b) => b._count - a._count)
                  .map((e, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="w-36 truncate text-xs font-medium">
                        {esitoContattoLabel(e.esitoContatto || "")}
                      </span>
                      <div className="flex-1 rounded-full bg-slate-100" style={{ height: 14 }}>
                        <div
                          className="h-full rounded-full bg-[#1a365d]"
                          style={{ width: `${(e._count / totEsiti) * 100}%`, minWidth: 8 }}
                        />
                      </div>
                      <span className="w-12 text-right text-[10px] text-[var(--muted)]">
                        {e._count} ({((e._count / totEsiti) * 100).toFixed(0)}%)
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
            ? "Carichi, documenti e incassi"
            : "Controllo complessivo delle pratiche";

  const dataLabel = dataIt(dataLavorate);
  const totaleLavorate = lavoratePerOperatore.reduce((s, o) => s + o.count, 0);
  const hintGiorno = totaleLavorate
    ? `${dataLabel} · ${totaleLavorate === 1 ? "1 pratica" : `${totaleLavorate} pratiche`} lavorate · ${codiciLavorazione.totalePratiche} con cambio codice`
    : `${dataLabel} · nessuna lavorazione`;
  const titoloLavorate = isOggi(dataLavorate) ? "Lavorate oggi" : "Lavorate";

  return (
    <div className="space-y-5 pb-8">
      <PageHeader title="Home" subtitle={subtitle} />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:gap-3">
        <DashboardKpi title="Pratiche visibili" value={totali} />
        <DashboardKpi title="Da affidare" value={nuove} />
        <DashboardKpi title="In lavorazione" value={inLavoro} />
        <DashboardKpi
          title={can(user, "incassi:create") ? "Incassi oggi" : "Scadute"}
          value={
            can(user, "incassi:create")
              ? euro(incassiOggi._sum.importo || 0)
              : scadute
          }
        />
        <div className="col-span-2 sm:col-span-4">
          <LavorateGiornoKpi
            title={titoloLavorate}
            hint={hintGiorno}
            dataIso={dataIso}
            operatori={lavoratePerOperatore}
            codiciLavorazione={codiciLavorazione}
            href={buildPraticheQuery({ lavorateData: dataIso })}
          />
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
          Sintesi lavorazione
        </h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8 lg:gap-2">
          {conteggiStato.map(({ stato, label, count }) => (
            <DashboardStato
              key={stato}
              label={label}
              count={count}
              stato={stato}
              href={buildPraticheQuery({ stato })}
            />
          ))}
        </div>
      </div>

      {!isManutenzione(user) ? (
        <div>
          <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
            Pratiche inattive
          </h2>
          <div className="grid grid-cols-2 gap-2 sm:max-w-md lg:gap-3">
            <DashboardKpi
              title="Non toccate da 7+ gg"
              value={nonToccate7}
              hint="Aperte · ultimo aggiornamento"
              href={buildPraticheQuery({ nonToccateDa: 7 })}
            />
            <DashboardKpi
              title="Non toccate da 15+ gg"
              value={nonToccate15}
              hint="Aperte · ultimo aggiornamento"
              href={buildPraticheQuery({ nonToccateDa: 15 })}
            />
          </div>
        </div>
      ) : null}

      {mostraGruppo ? (
        <GruppoLavoroHomeCard
          gruppo={gruppo}
          currentUserId={user.id}
          canManage={user.role === "SUPERVISOR"}
        />
      ) : null}

    </div>
  );
}
