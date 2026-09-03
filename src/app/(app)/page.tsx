import { Suspense } from "react";
import Link from "next/link";
import { buildHomeKpiContext } from "@/lib/homeKpi/buildContext";
import { loadHomeKpiAuto } from "@/lib/homeKpi/loadHomeKpi";
import { usersDbFromUser } from "@/lib/usersRepo";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/guard";
import { can, isManutenzione } from "@/lib/permissions";
import { euro, dataIt } from "@/lib/domain";
import {
  formatDataIso,
  isOggi,
  parseDataIso,
  startOfToday,
} from "@/lib/lavorateOggi";
import {
  praticaScopeWhere,
  resolveGruppoPerimetroContext,
  gruppoPerimetroOptsFromContext,
  buildGruppoPerimetroContextFromGruppo,
  praticaScopeForGruppoContext,
} from "@/lib/gruppoPerimetroScope";
import { PageHeader } from "@/components/ui";
import { metodoIncassoLabel } from "@/lib/metodoIncasso";
import { buildPraticheQuery } from "@/components/PaginazioneBar";
import { getGruppoLavoro, getGruppoLavoroForSupervisor } from "@/lib/gruppoLavoro";
import { DashboardKpi } from "@/components/home/DashboardStat";
import { MissingSedeBanner, RicaviAltreSediNascostiBanner } from "@/components/sedi/MissingSedeBanner";
import { SedeRendimentoFilter } from "@/components/sedi/SedeRendimentoFilter";
import { sedeScopeForRendimento } from "@/lib/sedeScope";
import { GruppoLavoroHomeCard } from "@/components/home/GruppoLavoroHomeCard";
import { FormazioneMonitorHomeCard } from "@/components/home/FormazioneMonitorHomeCard";
import { HomeGruppoPicker } from "@/components/home/HomeGruppoPicker";
import { LavorateGiornoKpi } from "@/components/home/LavorateGiornoKpi";
import { CodiciMandantePerimetroTable } from "@/components/home/CodiciMandantePerimetroTable";
import { InLavorazionePerimetroCard } from "@/components/home/InLavorazionePerimetroCard";
import { DaAffidarePerimetroCard } from "@/components/home/DaAffidarePerimetroCard";
import { IncassiTipologiaFiltri } from "@/components/home/IncassiTipologiaFiltri";
import { rangeMeseIncassi } from "@/lib/incassiMeseFiltro";
import type { RiepilogoMandanteDto } from "@/lib/data/contracts/dashboard";

function RiepilogoMandantiTable({
  righe,
  mostraTotali = true,
}: {
  righe: RiepilogoMandanteDto[];
  mostraTotali?: boolean;
}) {
  const totAffidato = righe.reduce((s, r) => s + r.affidato, 0);
  const totIncassato = righe.reduce((s, r) => s + r.incassato, 0);
  const totRicavoLordo = righe.reduce((s, r) => s + r.ricavoLordo, 0);
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
                  <th className="text-right">Ricavo lordo</th>
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
                    <td className="text-right font-semibold text-emerald-700">
                      {euro(r.ricavoLordo)}
                    </td>
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
                <td className="text-right text-emerald-700">{euro(totRicavoLordo)}</td>
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
    incMese?: string;
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
    incMese,
    gruppo: gruppoRaw,
    sede: sedeRaw,
  } = sp;
  const dataLavorate = parseDataIso(lavorateDataRaw) ?? startOfToday();
  const dataIso = formatDataIso(dataLavorate);

  const isBackOfficeGruppo = user.role === "BACK_OFFICE" && !isManutenzione(user);
  const supervisoriHome = isBackOfficeGruppo
    ? await usersDbFromUser(user).findMany({
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

  const kpiCtx = await buildHomeKpiContext(user, sp, {
    gruppo,
    periCtx,
    targetSupervisorId,
  });

  const kpi = await loadHomeKpiAuto(kpiCtx, {
    user,
    where,
    gruppo,
    periCtx,
    mostraGruppo,
    vistaGruppoLavorate,
    gruppoPerimetroOpts,
    dataLavorate,
    sedeScopeId: kpiCtx.sedeScopeId,
    incMandante,
    incPerimetro,
  });

  const {
    totali,
    scadute,
    incassiOggiSum,
    inLavoroPerPerimetro,
    lavoratePerOperatore,
    praticheLavorateGruppo,
    praticheCambioCodice,
    codiciMandantePerimetro,
    daAffidareGruppo,
  } = kpi.shared;

  const incassiOggi = { _sum: { importo: incassiOggiSum } };

  if (user.role === "AMMINISTRAZIONE") {
    const amm = kpi.amministrazione!;
    const { sedeId: sedeFiltro } = sedeScopeForRendimento(user, sedeRaw);
    const sedeRicavi = user.sedeId || undefined;

    return (
      <div className="space-y-5 pb-8">
        <PageHeader
          title="Home"
          subtitle="Amministrazione · tutte le sedi (ricavi solo sede propria)"
        />

        <SedeRendimentoFilter
          sedi={amm.sediOpts}
          sedeId={sedeFiltro}
          basePath="/"
          keepParams={{
            lavorateData: lavorateDataRaw,
            incMandante,
            incPerimetro,
            incMese,
            gruppo: gruppoRaw,
          }}
        />

        {!user.sedeId ? <MissingSedeBanner /> : null}
        {user.sedeId && sedeFiltro && sedeFiltro !== user.sedeId ? (
          <RicaviAltreSediNascostiBanner sedeNomePropria={user.sedeNome} />
        ) : null}

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:gap-3">
          {amm.mostraRicavi && sedeRicavi ? (
            <>
              <DashboardKpi
                title="Provvigioni mese (tua sede)"
                value={euro(amm.provvigioniMeseSum || 0)}
              />
              <DashboardKpi
                title="Provv. da liquidare (tua sede)"
                value={euro(amm.provvigioniDaLiquidareSum || 0)}
                hint="Totale maturate non ancora erogate"
              />
            </>
          ) : (
            <>
              <DashboardKpi title="Provvigioni mese" value="—" hint="Solo sulla tua sede" />
              <DashboardKpi title="Provv. da liquidare" value="—" hint="Solo sulla tua sede" />
            </>
          )}
          <DashboardKpi title="Pratiche totali" value={amm.totPratiche} />
          <DashboardKpi title="Provvigioni" value="Dettaglio" href="/provigioni" />
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:gap-3">
          <DashboardKpi title="Mandanti" value={amm.mandantiCount} href="/mandanti" />
          <DashboardKpi title="Operatori attivi" value={amm.operatoriCount} href="/operatori" />
        </div>
      </div>
    );
  }

  if (user.role === "ADMIN") {
    const admin = kpi.admin!;
    const { sedeId: sedeScopeId } = sedeScopeForRendimento(user, sedeRaw);

    const mandantiRiepilogo = admin.mandantiRiepilogo;
    const totAffidato = mandantiRiepilogo.reduce((s, r) => s + r.affidato, 0);
    const totIncassato = mandantiRiepilogo.reduce((s, r) => s + r.incassato, 0);
    const totRicavoLordo = mandantiRiepilogo.reduce((s, r) => s + r.ricavoLordo, 0);
    const totPerc = totAffidato > 0 ? (totIncassato / totAffidato) * 100 : 0;

    const mandantiFiltriUi = admin.mandantiFiltriUi;
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

    const totImportoMetodi = admin.tipologieIncasso.reduce((s, r) => s + r.importo, 0);
    const tipologieIncasso = admin.tipologieIncasso
      .map((t) => ({
        metodo: t.metodo,
        label: metodoIncassoLabel(t.metodo),
        pezzi: t.pezzi,
        importo: t.importo,
        perc: totImportoMetodi > 0 ? (t.importo / totImportoMetodi) * 100 : 0,
        meseImporto: t.meseImporto,
        mesePezzi: t.mesePezzi,
      }))
      .sort((a, b) => b.importo - a.importo);

    const mesiIndietro = 6;
    const incassiPerMandanteMese = admin.incassiPerMandanteMese;
    const maxMese = Math.max(...incassiPerMandanteMese.map((m) => m.totale), 1);
    const colori = ["#2563eb", "#16a34a", "#d97706", "#dc2626", "#7c3aed", "#0891b2", "#be185d", "#65a30d"];
    const mandantiAttivi = admin.mandantiAttivi;
    const { label: meseIncassiLabel } = rangeMeseIncassi(incMese);
    const meseColonnaLabel = incMese ? meseIncassiLabel : "Mese corrente";

    const sedeNomeAttiva = sedeScopeId
      ? admin.sediOpts.find((s) => s.id === sedeScopeId)?.nome
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
          sedi={admin.sediOpts}
          sedeId={sedeScopeId}
          basePath="/"
          keepParams={{
            lavorateData: lavorateDataRaw,
            incMandante,
            incPerimetro,
            incMese,
            gruppo: gruppoRaw,
          }}
        />

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 lg:gap-3">
          <DashboardKpi title="Mandanti" value={mandantiAttivi.length} href="/mandanti" />
          <DashboardKpi
            title="Pratiche"
            value={mandantiRiepilogo.reduce((s, r) => s + r.pratiche, 0)}
            href="/pratiche"
          />
          <DashboardKpi title="Totale affidato" value={euro(totAffidato)} />
          <DashboardKpi title="Totale incassato" value={euro(totIncassato)} />
          <DashboardKpi
            title="% Recupero"
            value={`${totPerc.toFixed(1)}%`}
          />
          <DashboardKpi title="Ricavo lordo" value={euro(totRicavoLordo)} href="/provigioni" />
          <DashboardKpi title="Operatori attivi" value={admin.operatoriCount} href="/operatori" />
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
                mese={incMese}
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
                        <th className="text-right capitalize">{meseColonnaLabel}</th>
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
