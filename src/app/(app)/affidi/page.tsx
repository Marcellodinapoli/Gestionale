import { usersDbFromUser } from "@/lib/usersRepo";
import { mandantiDbFromUser } from "@/lib/mandantiRepo";
import { praticaDb, resolveTenantSlug } from "@/lib/praticheRepo";
import { requireModule, requireNavPage } from "@/lib/guard";
import { isManutenzione } from "@/lib/permissions";
import { Card, PageHeader } from "@/components/ui";
import {
  AffidiDaAffidareTable,
  type AffidiRigaLista,
} from "@/components/affidi/AffidiDaAffidareTable";
import { AffidiPraticheOperatore } from "@/components/affidi/AffidiPraticheOperatore";
import {
  AffidiCaricoOperatori,
  buildCaricoOperatori,
  buildAffidiHref,
  etichettaCodaAffidi,
  filtraPraticheAffido,
  parseCodaAffidi,
  type AffidiNavParams,
} from "@/components/affidi/AffidiCaricoOperatori";
import Link from "next/link";
import { Suspense } from "react";
import { AffidiScrollAffida } from "@/components/affidi/AffidiScrollAffida";
import { parsePerimetriList } from "@/lib/mandantePerimetri";
import { parsePerimetroAffidi } from "@/lib/affidiPerimetro";
import {
  etichettaAffidiAllerta,
  filtraPratichePerAllerta,
  computeAffidiMonitoraggioAllerte,
  parseAffidiAllerta,
  praticaMonitorWhere,
} from "@/lib/affidi/loadAffidiMonitoraggio";
import {
  riepilogoCodiciScaricoDettaglio,
  scarichiOperatoreDaRiepilogo,
} from "@/lib/homeKpi/codiciScaricoAdmin";
import {
  etichettaFiltriMonitorAffidi,
  filtraPraticheAffidiMonitor,
  mandantiConPerimetriAffidi,
  numeriMandantePerFiltroPerimetro,
  risolviFiltriMonitorAffidi,
} from "@/lib/affidi/affidiMonitorPerimetri";
import { incassatoMesePerOperatore } from "@/lib/affidi/incassatoMeseOperatore";
import { guadagnoMesePerOperatore } from "@/lib/affidi/guadagnoMeseOperatore";
import { AffidiMonitoraggioPanel } from "@/components/affidi/AffidiMonitoraggioPanel";
import { AffidiAllerteCards } from "@/components/affidi/AffidiAllerteCards";
import { AffidiIncassiOperatori } from "@/components/affidi/AffidiIncassiOperatori";
import { righeIncassoDaCarico } from "@/lib/affidi/righeIncassoOperatore";
import { parseIncMeseParam, rangeMeseIncassi } from "@/lib/incassiMeseFiltro";
import { getGruppoLavoro, getGruppoLavoroForSupervisor } from "@/lib/gruppoLavoro";
import {
  buildGruppoPerimetroContextFromGruppo,
  resolveGruppoPerimetroContext,
} from "@/lib/gruppoPerimetroScope";
import { loadCodiciMandantePerimetroLikeHome } from "@/lib/homeKpi/loadCodiciMandantePerimetroHome";
import { AffidiCodiciMandantePerimetroSection } from "@/components/affidi/AffidiCodiciMandantePerimetroSection";
import { visibileInElencoAffidiSupervisor } from "@/lib/affidi/affidiPraticaStatoUi";
import {
  mapPraticaEntityToListaRow,
  praticaListaInclude,
  type PraticaListaRow,
} from "@/lib/praticheListaRow";

export default async function AffidiPage({
  searchParams,
}: {
  searchParams: Promise<{
    operatore?: string;
    coda?: string;
    mandato?: string;
    perimetro?: string;
    caricoMandato?: string;
    caricoPerimetro?: string;
    caricoMese?: string;
    caricoCerca?: string;
    affidaSort?: string;
    affidaDir?: string;
    affidaPage?: string;
    allerta?: string;
    affidaCerca?: string;
    gruppo?: string;
  }>;
}) {
  await requireModule("affidi");
  const user = await requireNavPage("affidi");
  const sp = await searchParams;
  const affidaQueryString = new URLSearchParams(
    Object.entries(sp).flatMap(([k, v]) =>
      v != null && v !== "" ? [[k, v] as [string, string]] : []
    )
  ).toString();
  const {
    operatore: operatoreRaw,
    coda: codaRaw,
    mandato: mandatoRaw,
    perimetro: perimetroRaw,
    caricoMandato: caricoMandatoRaw,
    caricoPerimetro: caricoPerimetroRaw,
    caricoMese: caricoMeseRaw,
    caricoCerca: caricoCercaRaw,
    affidaPage: affidaPageRaw,
    allerta: allertaRaw,
    affidaCerca: affidaCercaRaw,
    gruppo: gruppoRaw,
  } = sp;
  const allertaOk = parseAffidiAllerta(allertaRaw);
  // Elenco Affida solo dopo Filtra o click su allerta.
  const showAffidaElenco = affidaCercaRaw === "1" || Boolean(allertaOk);

  const vuoto = isManutenzione(user);
  /** Vista Affidi come admin: ADMIN, SUPERVISOR e BACK_OFFICE. */
  const mostraMonitor =
    user.role === "ADMIN" || user.role === "BACK_OFFICE" || user.role === "SUPERVISOR";

  if (!mostraMonitor) {
    return (
      <div className="h-full min-h-0 space-y-4 overflow-y-auto">
        <PageHeader title="Affidi" subtitle="Accesso non disponibile per questo profilo." />
      </div>
    );
  }

  const mandantiDb = vuoto
    ? []
    : await mandantiDbFromUser(user).findMany({
        where: { tenantId: user.tenantId },
        orderBy: { codice: "asc" },
        select: { id: true, codice: true, ragioneSociale: true, perimetri: true },
      });

  const mandantiOptions = mandantiDb.map((m) => ({
    id: m.id,
    codice: m.codice,
    ragioneSociale: m.ragioneSociale,
    perimetri: parsePerimetriList(m.perimetri),
  }));

  const mandantiMonitor = mandantiConPerimetriAffidi(mandantiDb);

  const operatori = vuoto
    ? []
    : await usersDbFromUser(user).findMany({
        where: {
          tenantId: user.tenantId,
          role: { in: ["OPERATOR", "SUPERVISOR"] },
          active: true,
        },
        orderBy: { name: "asc" },
        select: { id: true, name: true, role: true, acronimo: true },
      });

  const membriCarico = operatori;
  const idsOperatoriFiltro = operatori.map((o) => o.id);

  const praticaAffidiSelect = {
    id: true,
    numero: true,
    stato: true,
    residuo: true,
    capitale: true,
    interessi: true,
    spese: true,
    scadenza: true,
    dataAffido: true,
    ultimaLavorazioneAt: true,
    esitoContatto: true,
    codiceScarico: true,
    codiceScaricoBk: true,
    mandanteId: true,
    numeroMandante: true,
    assegnatarioId: true,
    operatoreTitolareId: true,
    debitore: praticaListaInclude.debitore,
    mandante: praticaListaInclude.mandante,
    assegnatario: { select: { id: true, name: true } },
    operatoreTitolare: { select: { id: true, name: true } },
    rate: praticaListaInclude.rate,
    incassi: praticaListaInclude.incassi,
    garanti: praticaListaInclude.garanti,
    importBatch: { select: { perimetro: true } },
    dataPassaggioGiudiziale: true,
    conferimentoTipo: true,
    giudiziale: { select: { statoAvvio: true } },
  } as const;

  const praticheScopeRaw = vuoto
    ? []
    : await praticaDb({
        tenantId: user.tenantId,
        tenantSlug: resolveTenantSlug(user),
        role: user.role,
        userId: user.id,
        skipRoleScope: true,
      }).findMany({
        where: { tenantId: user.tenantId },
        select: praticaAffidiSelect,
        orderBy: { numero: "asc" },
      });
  const praticheScope = praticheScopeRaw.map((p) => ({
    ...p,
    importBatchPerimetro: p.importBatch?.perimetro ?? null,
    statoAvvioGiudiziale: p.giudiziale?.statoAvvio ?? null,
  }));
  const praticheScopeById = new Map(praticheScope.map((p) => [p.id, p]));
  function affidiListaRow(id: string): PraticaListaRow {
    const p = praticheScopeById.get(id);
    if (!p) throw new Error(`Pratica ${id} non in scope Affidi`);
    return mapPraticaEntityToListaRow(p, `/pratiche/${id}`);
  }
  function affidiRigaLista(p: { id: string; assegnatarioId: string | null; operatoreTitolareId: string | null }) {
    const full = praticheScopeById.get(p.id);
    if (!full) throw new Error(`Pratica ${p.id} non in scope Affidi`);
    return {
      lista: affidiListaRow(p.id),
      assegnatarioId: p.assegnatarioId,
      operatoreTitolareId: p.operatoreTitolareId,
      operatoreTitolareNome: full.operatoreTitolare?.name ?? null,
    } satisfies AffidiRigaLista;
  }
  const praticheAffidabili = praticheScope;
  const daAssegnare = praticheScope.filter((p) => p.assegnatarioId == null);
  const affidate = praticheScope.filter((p) => p.assegnatarioId != null);

  const carico = buildCaricoOperatori(membriCarico, affidate);
  const selezionatoId =
    operatoreRaw && idsOperatoriFiltro.includes(operatoreRaw) ? operatoreRaw : undefined;
  const coda = parseCodaAffidi(codaRaw);
  const codaEff =
    user.role === "SUPERVISOR" && coda === "scadute" ? undefined : coda;
  const selezionato = selezionatoId
    ? membriCarico.find((m) => m.id === selezionatoId) ??
      operatori.find((m) => m.id === selezionatoId)
    : undefined;

  const { mandanteOk: mandatoMonitorOk, perimetroOk: perimetroMonitorOk } = risolviFiltriMonitorAffidi(
    mandantiMonitor,
    mandatoRaw,
    parsePerimetroAffidi(perimetroRaw)
  );
  const { mandanteOk: mandatoCaricoOk, perimetroOk: perimetroCaricoOk } = risolviFiltriMonitorAffidi(
    mandantiMonitor,
    caricoMandatoRaw,
    parsePerimetroAffidi(caricoPerimetroRaw)
  );
  const monitorExtraParams: Pick<
    AffidiNavParams,
    "operatore" | "coda" | "sezione" | "caricoMandato" | "caricoPerimetro" | "caricoMese"
  > = {
    operatore: selezionatoId,
    coda: codaRaw as AffidiNavParams["coda"],
    caricoMandato: mandatoCaricoOk,
    caricoPerimetro: perimetroCaricoOk,
    caricoMese: caricoMeseRaw,
  };
  const filtroMonitorLabel = etichettaFiltriMonitorAffidi(
    mandantiMonitor,
    mandatoMonitorOk,
    perimetroMonitorOk
  );
  const filtroCaricoLabel = etichettaFiltriMonitorAffidi(
    mandantiMonitor,
    mandatoCaricoOk,
    perimetroCaricoOk
  );
  const { label: meseCaricoLabel } = rangeMeseIncassi(caricoMeseRaw);
  const annoCarico = parseIncMeseParam(caricoMeseRaw).year;
  // Tabelle incassi/pratiche per operatore solo dopo Filtra (caricoCerca=1).
  const showCaricoKpi =
    mostraMonitor &&
    !vuoto &&
    (caricoCercaRaw === "1" ||
      Boolean(caricoMandatoRaw || caricoPerimetroRaw || caricoMeseRaw));
  const numeriCarico = numeriMandantePerFiltroPerimetro(
    mandantiMonitor,
    perimetroCaricoOk,
    mandatoCaricoOk,
    praticheScope
  );
  const praticaWhereCarico = praticaMonitorWhere(
    user.tenantId,
    mandatoCaricoOk,
    perimetroCaricoOk,
    numeriCarico
  );
  const affidateMonitor = mostraMonitor
    ? filtraPraticheAffidiMonitor(
        affidate,
        mandantiMonitor,
        mandatoMonitorOk,
        perimetroMonitorOk
      )
    : affidate;
  const affidateCarico = mostraMonitor
    ? filtraPraticheAffidiMonitor(
        affidate,
        mandantiMonitor,
        mandatoCaricoOk,
        perimetroCaricoOk
      )
    : affidate;
  const operatorIdsCarico = membriCarico.map((m) => m.id);
  const [scarichiDettaglio, incassatoMese, guadagnoMese] = showCaricoKpi
    ? await Promise.all([
        riepilogoCodiciScaricoDettaglio(user, {
          praticaWhere: praticaWhereCarico,
          incMese: caricoMeseRaw,
          operatorIds: operatorIdsCarico,
        }),
        incassatoMesePerOperatore(user, {
          praticaWhere: praticaWhereCarico,
          incMese: caricoMeseRaw,
          operatorIds: operatorIdsCarico,
        }),
        guadagnoMesePerOperatore(user, {
          praticaWhere: praticaWhereCarico,
          incMese: caricoMeseRaw,
          operatorIds: operatorIdsCarico,
        }),
      ])
    : [null, null, null];
  const scarichiGruppo = scarichiDettaglio
    ? scarichiOperatoreDaRiepilogo(scarichiDettaglio.riepilogo)
    : undefined;
  const navCarico: Pick<
    AffidiNavParams,
    | "mandato"
    | "perimetro"
    | "caricoMandato"
    | "caricoPerimetro"
    | "caricoMese"
    | "caricoCerca"
    | "operatore"
    | "coda"
  > = {
    mandato: mandatoMonitorOk,
    perimetro: perimetroMonitorOk,
    caricoMandato: mandatoCaricoOk,
    caricoPerimetro: perimetroCaricoOk,
    caricoMese: caricoMeseRaw,
    caricoCerca: showCaricoKpi ? "1" : undefined,
    operatore: selezionatoId,
    coda: codaRaw as AffidiNavParams["coda"],
  };
  const caricoPerimetro = buildCaricoOperatori(
    membriCarico,
    affidateCarico,
    new Date(),
    scarichiDettaglio?.perOperatore,
    incassatoMese?.perOperatore,
    guadagnoMese?.perOperatore
  );
  const mostraCaricoMonitor = showAffidaElenco && Boolean(mandatoMonitorOk);
  const caricoConScarichi =
    scarichiDettaglio || incassatoMese
      ? buildCaricoOperatori(
          membriCarico,
          affidateCarico,
          new Date(),
          scarichiDettaglio?.perOperatore,
          incassatoMese?.perOperatore,
          guadagnoMese?.perOperatore
        )
      : carico;

  const mostraElenco = Boolean(selezionatoId || codaEff);
  const affidatePerElencoOperatore =
    mostraCaricoMonitor && !showCaricoKpi ? affidateMonitor : affidateCarico;
  const praticheSelezionatoRaw = mostraElenco
    ? filtraPraticheAffido(affidatePerElencoOperatore, {
        operatoreId: selezionatoId,
        coda: codaEff,
      })
    : [];
  const praticheSelezionato =
    user.role === "SUPERVISOR"
      ? praticheSelezionatoRaw.filter(visibileInElencoAffidiSupervisor)
      : praticheSelezionatoRaw;
  const titoloElenco = [
    mandatoRaw ? mandantiOptions.find((m) => m.id === mandatoRaw)?.codice : null,
    selezionato
      ? `Pratiche di ${selezionato.name}`
      : "Pratiche filtrate",
    codaEff ? `· ${etichettaCodaAffidi(codaEff)}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const subtitle = `Assegna le pratiche nuove e monitora il carico operatori`;

  const praticheAffidabiliMonitor = mostraMonitor
    ? filtraPraticheAffidiMonitor(
        praticheAffidabili,
        mandantiMonitor,
        mandatoMonitorOk,
        perimetroMonitorOk
      )
    : praticheAffidabili;
  const praticheAffidabiliAllertaBase = filtraPratichePerAllerta(
    praticheAffidabiliMonitor,
    allertaOk
  );
  const praticheAffidabiliAllerta =
    user.role === "SUPERVISOR" && allertaOk !== "scadute"
      ? praticheAffidabiliAllertaBase.filter(visibileInElencoAffidiSupervisor)
      : praticheAffidabiliAllertaBase;
  const daAssegnareMonitor = praticheAffidabiliAllerta.filter((p) => p.assegnatarioId == null);
  const filtroMonitorAttivo = Boolean(mandatoMonitorOk || perimetroMonitorOk);
  const praticheConteggioAllerte =
    user.role === "BACK_OFFICE"
      ? filtroMonitorAttivo
        ? praticheAffidabiliMonitor
        : praticheAffidabili
      : praticheAffidabiliMonitor;
  const monitorAllineato =
    mostraMonitor && !vuoto
      ? computeAffidiMonitoraggioAllerte(praticheConteggioAllerte, user.role)
      : null;
  const allertaLabel = etichettaAffidiAllerta(allertaOk);
  const allertePanel =
    monitorAllineato && mostraMonitor ? (
      <AffidiAllerteCards
        monitor={monitorAllineato}
        mandatoId={mandatoMonitorOk}
        perimetro={perimetroMonitorOk}
        allertaAttiva={allertaOk}
        extraParams={monitorExtraParams}
        layoutBackOffice={user.role === "BACK_OFFICE"}
        filtroLabel={filtroMonitorAttivo ? filtroMonitorLabel : undefined}
      />
    ) : null;
  const codiciMandantePerimetroAffidi =
    mostraMonitor && !vuoto && showAffidaElenco
      ? await (async () => {
          let gruppo = await getGruppoLavoro(user);
          let periCtx = await resolveGruppoPerimetroContext(user);
          if (user.role === "SUPERVISOR" || user.role === "BACK_OFFICE") {
            const supervisori = await usersDbFromUser(user).findMany({
              where: { tenantId: user.tenantId, role: "SUPERVISOR", active: true },
              orderBy: { name: "asc" },
              select: { id: true },
            });
            const targetSupervisorId =
              supervisori.length === 0
                ? null
                : gruppoRaw && supervisori.some((s) => s.id === gruppoRaw)
                  ? gruppoRaw
                  : user.role === "SUPERVISOR"
                    ? user.id
                    : supervisori[0]!.id;
            if (targetSupervisorId) {
              gruppo = await getGruppoLavoroForSupervisor(
                user.tenantId,
                targetSupervisorId
              );
              periCtx = await buildGruppoPerimetroContextFromGruppo(user.tenantId, gruppo);
            }
          }
          const mostraGruppo =
            Boolean(gruppo.supervisorName) &&
            gruppo.members.some((m) => m.role === "SUPERVISOR") &&
            (user.role === "SUPERVISOR" || user.role === "BACK_OFFICE");
          return loadCodiciMandantePerimetroLikeHome(user, {
            gruppo,
            periCtx,
            mostraGruppo,
          });
        })()
      : null;

  const monitorPanel = mostraMonitor ? (
      <AffidiMonitoraggioPanel
        mandanti={mandantiMonitor}
        mandatoId={mandatoMonitorOk}
        perimetro={perimetroMonitorOk}
        searchActive={showAffidaElenco}
        extraParams={monitorExtraParams}
      />
    ) : null;

  return (
    <div className="h-full min-h-0 space-y-4 overflow-y-auto">
      <PageHeader title="Affidi" subtitle={subtitle} />
      <Suspense fallback={null}>
        <AffidiScrollAffida />
      </Suspense>

      {allertePanel}

      {showCaricoKpi && incassatoMese ? (
        <Card title="Incassi per operatore">
          {!caricoConScarichi.length ? (
            <p className="text-sm text-[var(--muted)]">Nessun operatore nel gruppo.</p>
          ) : (
            <>
              <p className="mb-3 text-xs text-[var(--muted)]">
                {filtroCaricoLabel} · Mese: {meseCaricoLabel}
                {" · "}
                <span className="text-[var(--muted)]">Clicca su un operatore per il dettaglio mensile del {annoCarico}.</span>
              </p>
              <AffidiIncassiOperatori
                righe={righeIncassoDaCarico(caricoConScarichi)}
                selezionatoId={selezionatoId}
                nav={navCarico}
                meseLabel={meseCaricoLabel}
                totaleGruppo={incassatoMese.totale}
                totaleGuadagno={guadagnoMese?.totale ?? 0}
                annoCarico={annoCarico}
                caricoMandato={mandatoCaricoOk}
                caricoPerimetro={perimetroCaricoOk}
                numeriMandante={numeriCarico}
                filtroCaricoLabel={filtroCaricoLabel}
              />
            </>
          )}
        </Card>
      ) : null}

      {showCaricoKpi ? (
      <Card title="Pratiche per operatore">
        {!caricoConScarichi.length ? (
          <p className="text-sm text-[var(--muted)]">Nessun operatore nel gruppo.</p>
        ) : (
          <>
            {scarichiGruppo ? (
              <p className="mb-3 text-xs text-[var(--muted)]">
                {filtroCaricoLabel} · Codici scarico · Mese: {meseCaricoLabel}
              </p>
            ) : (
              <p className="mb-3 text-xs text-[var(--muted)]">{filtroCaricoLabel}</p>
            )}
            <AffidiCaricoOperatori
              carico={caricoConScarichi}
              selezionatoId={selezionatoId}
              coda={coda}
              nav={navCarico}
              meseLabel={meseCaricoLabel}
              scarichiGruppo={scarichiGruppo}
            />
            {mostraElenco ? (
              <p className="mt-2 text-xs text-[var(--muted)]">
                <Link
                  href={buildAffidiHref({
                    mandato: mandatoMonitorOk,
                    perimetro: perimetroMonitorOk,
                    caricoMandato: mandatoCaricoOk,
                    caricoPerimetro: perimetroCaricoOk,
                    caricoMese: caricoMeseRaw,
                    caricoCerca: "1",
                  })}
                  className="underline"
                >
                  Chiudi dettaglio
                </Link>
              </p>
            ) : (
              <p className="mt-2 text-xs text-[var(--muted)]">
                Clicca un numero o un operatore per aprire le pratiche corrispondenti.
              </p>
            )}
          </>
        )}
      </Card>
      ) : null}

      {mostraElenco && showCaricoKpi ? (
        <Card title={titoloElenco}>
          <AffidiPraticheOperatore
            nome={titoloElenco}
            righe={praticheSelezionato.map((p) => affidiListaRow(p.id))}
            praticheStatoInput={praticheSelezionato.map((p) => ({
              id: p.id,
              assegnatarioId: p.assegnatarioId,
              operatoreTitolareId: p.operatoreTitolareId,
              stato: p.stato,
            }))}
            operatori={operatori}
            affidaQuery={affidaQueryString}
          />
        </Card>
      ) : null}

      {monitorPanel}

      {codiciMandantePerimetroAffidi && mostraMonitor && showAffidaElenco ? (
        <AffidiCodiciMandantePerimetroSection
          user={user}
          righe={codiciMandantePerimetroAffidi.righe}
          righePerOperatore={codiciMandantePerimetroAffidi.righePerOperatore}
        />
      ) : null}

      {mostraElenco && mostraCaricoMonitor ? (
        <Card title={titoloElenco}>
          <AffidiPraticheOperatore
            nome={titoloElenco}
            righe={praticheSelezionato.map((p) => affidiListaRow(p.id))}
            praticheStatoInput={praticheSelezionato.map((p) => ({
              id: p.id,
              assegnatarioId: p.assegnatarioId,
              operatoreTitolareId: p.operatoreTitolareId,
              stato: p.stato,
            }))}
            operatori={operatori}
            affidaQuery={affidaQueryString}
          />
        </Card>
      ) : null}

      <Card id="affida" title="Affida / riaffida pratiche">
        {!showAffidaElenco ? (
          <p className="px-1 py-8 text-center text-sm text-[var(--muted)]">
            Nessun elenco caricato. Imposta i filtri in Monitoraggio operativo e premi{" "}
            <span className="font-semibold text-[var(--navy)]">Filtra</span>, oppure clicca una
            card Allerte.
          </p>
        ) : (
          <>
            {filtroMonitorLabel !== "Tutti i mandati e perimetri" ? (
              <p className="mb-2 text-xs text-[var(--muted)]">{filtroMonitorLabel}</p>
            ) : null}
            {allertaLabel ? (
              <p className="mb-2 text-xs font-medium text-[var(--navy)]">
                Allerta: {allertaLabel} ·{" "}
                <a
                  href={buildAffidiHref({
                    mandato: mandatoMonitorOk,
                    perimetro: perimetroMonitorOk,
                    ...monitorExtraParams,
                    sezione: "affida",
                    affidaCerca: "1",
                  })}
                  className="underline"
                >
                  Mostra tutte
                </a>
              </p>
            ) : null}
            {!praticheAffidabiliAllerta.length ? (
              <p className="text-sm text-[var(--muted)]">
                Nessuna pratica con i filtri selezionati.
              </p>
            ) : (
              <>
                <p className="mb-3 text-xs text-[var(--muted)]">
                  {daAssegnareMonitor.length} non assegnate ·{" "}
                  {praticheAffidabiliAllerta.length - daAssegnareMonitor.length} già affidate
                  (definitivo o temporaneo). Puoi riaffidare anche quelle già in carico.
                </p>
                <AffidiDaAffidareTable
                  operatori={operatori}
                  affidaPage={affidaPageRaw}
                  affidaQuery={affidaQueryString}
                  righe={praticheAffidabiliAllerta.map(affidiRigaLista)}
                />
              </>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
