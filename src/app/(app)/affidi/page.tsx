import { usersDbFromUser } from "@/lib/usersRepo";
import { mandantiDbFromUser } from "@/lib/mandantiRepo";
import { praticaDbFromUser } from "@/lib/praticheRepo";
import { requirePermission } from "@/lib/guard";
import { praticaScopeWhere, resolveGruppoPerimetroContext } from "@/lib/gruppoPerimetroScope";
import { getGruppoLavoro } from "@/lib/gruppoLavoro";
import { isManutenzione } from "@/lib/permissions";
import { Card, PageHeader } from "@/components/ui";
import { AffidiDaAffidareTable } from "@/components/affidi/AffidiDaAffidareTable";
import { AffidiFiltroOperatore } from "@/components/affidi/AffidiFiltroOperatore";
import { AffidiPraticheOperatore } from "@/components/affidi/AffidiPraticheOperatore";
import { AffidiPerimetroOverview } from "@/components/affidi/AffidiPerimetroOverview";
import { AffidiFiltriBackOffice } from "@/components/affidi/AffidiFiltriBackOffice";
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
import { GruppoInlineEditor } from "@/components/affidi/GruppoInlineEditor";
import { AffidiIndietroLink } from "@/components/affidi/AffidiIndietroLink";
import { AffidiScrollAffida } from "@/components/affidi/AffidiScrollAffida";
import { parsePerimetriList } from "@/lib/mandantePerimetri";
import {
  elencoPerimetriGruppoConfig,
  elencoPerimetriTuttiMandanti,
  filtraPratichePerPerimetro,
  parsePerimetroAffidi,
} from "@/lib/affidiPerimetro";
import { loadAffidiMonitoraggio, praticaMonitorWhere } from "@/lib/affidi/loadAffidiMonitoraggio";
import {
  riepilogoCodiciScaricoDettaglio,
  scarichiOperatoreDaRiepilogo,
} from "@/lib/homeKpi/codiciScaricoAdmin";
import {
  etichettaFiltriMonitorAffidi,
  filtraPraticheAffidiMonitor,
  mandantiConPerimetriAffidi,
  risolviFiltriMonitorAffidi,
} from "@/lib/affidi/affidiMonitorPerimetri";
import { incassatoMesePerOperatore } from "@/lib/affidi/incassatoMeseOperatore";
import { guadagnoMesePerOperatore } from "@/lib/affidi/guadagnoMeseOperatore";
import { AffidiMonitoraggioPanel } from "@/components/affidi/AffidiMonitoraggioPanel";
import { AffidiCaricoFiltri } from "@/components/affidi/AffidiCaricoFiltri";
import { AffidiIncassiOperatori } from "@/components/affidi/AffidiIncassiOperatori";
import { righeIncassoDaCarico } from "@/lib/affidi/righeIncassoOperatore";
import { parseIncMeseParam, rangeMeseIncassi } from "@/lib/incassiMeseFiltro";
import { prisma } from "@/lib/prisma";

function mapPraticaAffidabile(
  p: {
    id: string;
    numero: string;
    stato: string;
    residuo: number;
    assegnatarioId: string | null;
    operatoreTitolareId: string | null;
    debitore: { nome: string; cognome: string };
    assegnatario: { name: string } | null;
    operatoreTitolare: { name: string } | null;
  }
) {
  return {
    id: p.id,
    numero: p.numero,
    stato: p.stato,
    residuo: p.residuo,
    debitoreNome: `${p.debitore.nome} ${p.debitore.cognome}`,
    assegnatarioId: p.assegnatarioId,
    assegnatarioNome: p.assegnatario?.name ?? null,
    operatoreTitolareId: p.operatoreTitolareId,
    operatoreTitolareNome: p.operatoreTitolare?.name ?? null,
  };
}

function ordinaPraticheAffidabili<
  T extends { assegnatarioId: string | null; numero: string }
>(pratiche: T[]) {
  return [...pratiche].sort((a, b) => {
    const aNuova = a.assegnatarioId ? 1 : 0;
    const bNuova = b.assegnatarioId ? 1 : 0;
    if (aNuova !== bNuova) return aNuova - bNuova;
    return a.numero.localeCompare(b.numero, "it");
  });
}

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
  }>;
}) {
  const user = await requirePermission("pratiche:assign");
  const {
    operatore: operatoreRaw,
    coda: codaRaw,
    mandato: mandatoRaw,
    perimetro: perimetroRaw,
    caricoMandato: caricoMandatoRaw,
    caricoPerimetro: caricoPerimetroRaw,
    caricoMese: caricoMeseRaw,
  } = await searchParams;

  const gruppo = await getGruppoLavoro(user);
  const vuoto = isManutenzione(user);
  const isSupervisor = user.role === "SUPERVISOR";
  const isBackOffice = user.role === "BACK_OFFICE";
  const isAdmin = user.role === "ADMIN";
  const isVistaGruppo = isSupervisor || isBackOffice;
  const mostraMonitor = isAdmin || isBackOffice;

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

  const lottiPerMandante = vuoto
    ? new Map<string, Set<string>>()
    : await (async () => {
        const rows = await prisma.pratica.groupBy({
          by: ["mandanteId", "numeroMandante"],
          where: { tenantId: user.tenantId, numeroMandante: { not: null } },
        });
        const map = new Map<string, Set<string>>();
        for (const row of rows) {
          const lotto = row.numeroMandante?.trim();
          if (!lotto) continue;
          const set = map.get(row.mandanteId) ?? new Set<string>();
          set.add(lotto);
          map.set(row.mandanteId, set);
        }
        return map;
      })();

  const mandantiMonitor = mandantiConPerimetriAffidi(mandantiDb, lottiPerMandante);

  const [operatori, tuttiOperatori, periCtx] = await Promise.all([
    vuoto
      ? Promise.resolve([])
      : isSupervisor
        ? usersDbFromUser(user).findMany({
            where: {
              tenantId: user.tenantId,
              supervisorId: user.id,
              active: true,
              role: "OPERATOR",
            },
            orderBy: { name: "asc" },
            select: { id: true, name: true, role: true, acronimo: true },
          })
        : usersDbFromUser(user).findMany({
            where: {
              tenantId: user.tenantId,
              role: { in: ["OPERATOR", "SUPERVISOR"] },
              active: true,
            },
            orderBy: { name: "asc" },
            select: { id: true, name: true, role: true, acronimo: true },
          }),
    vuoto
      ? Promise.resolve([])
      : isSupervisor
        ? usersDbFromUser(user).findMany({
            where: { tenantId: user.tenantId, role: "OPERATOR", active: true },
            orderBy: { name: "asc" },
            select: {
              id: true,
              name: true,
              supervisorId: true,
              supervisor: { select: { name: true } },
            },
          })
        : Promise.resolve([]),
    isSupervisor ? resolveGruppoPerimetroContext(user) : Promise.resolve(null),
  ]);

  const membriCarico = isSupervisor ? gruppo.members : operatori;
  const memberIds = membriCarico.map((m) => m.id);
  const idsOperatoriFiltro = isSupervisor ? memberIds : operatori.map((o) => o.id);
  const baseScope = await praticaScopeWhere(user);

  const praticheScope = await praticaDbFromUser(user).findMany({
    where: { AND: [baseScope] },
    select: {
      id: true,
      numero: true,
      stato: true,
      residuo: true,
      scadenza: true,
      codiceScarico: true,
      mandanteId: true,
      numeroMandante: true,
      assegnatarioId: true,
      operatoreTitolareId: true,
      debitoreId: true,
      debitore: { select: { nome: true, cognome: true } },
      mandante: { select: { codice: true } },
      assegnatario: { select: { id: true, name: true } },
      operatoreTitolare: { select: { id: true, name: true } },
    },
    orderBy: { numero: "asc" },
  });
  const praticheAffidabili = praticheScope;
  const daAssegnare = praticheScope.filter((p) => p.assegnatarioId == null);
  const affidate = praticheScope.filter((p) => p.assegnatarioId != null);

  const carico = buildCaricoOperatori(membriCarico, affidate);
  const selezionatoId =
    operatoreRaw && idsOperatoriFiltro.includes(operatoreRaw) ? operatoreRaw : undefined;
  const coda = parseCodaAffidi(codaRaw);
  const selezionato = selezionatoId
    ? membriCarico.find((m) => m.id === selezionatoId) ??
      operatori.find((m) => m.id === selezionatoId)
    : undefined;

  const perimetriDisponibili = isSupervisor
    ? elencoPerimetriGruppoConfig(gruppo.gruppoMandanti, mandantiOptions)
    : isBackOffice
      ? elencoPerimetriTuttiMandanti(mandantiOptions)
      : [];
  const perimetroDecoded = parsePerimetroAffidi(perimetroRaw);
  const refPerimetro =
    isVistaGruppo && mandatoRaw && perimetroDecoded
      ? perimetriDisponibili.find(
          (r) => r.mandanteId === mandatoRaw && r.perimetro === perimetroDecoded
        )
      : undefined;

  const { mandanteOk: mandatoMonitorOk, perimetroOk: perimetroMonitorOk } = risolviFiltriMonitorAffidi(
    mandantiMonitor,
    mandatoRaw,
    refPerimetro?.perimetro ?? parsePerimetroAffidi(perimetroRaw)
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
  const caricoExtraParams: Pick<AffidiNavParams, "mandato" | "perimetro" | "coda" | "sezione"> = {
    mandato: mandatoMonitorOk,
    perimetro: perimetroMonitorOk,
    coda: codaRaw as AffidiNavParams["coda"],
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
  const praticaWhereMonitor = praticaMonitorWhere(
    user.tenantId,
    mandatoMonitorOk,
    perimetroMonitorOk
  );
  const praticaWhereCarico = praticaMonitorWhere(
    user.tenantId,
    mandatoCaricoOk,
    perimetroCaricoOk
  );
  const affidateMonitor = mostraMonitor
    ? filtraPraticheAffidiMonitor(affidate, mandatoMonitorOk, perimetroMonitorOk)
    : affidate;
  const affidateCarico = mostraMonitor
    ? filtraPraticheAffidiMonitor(affidate, mandatoCaricoOk, perimetroCaricoOk)
    : affidate;
  const operatorIdsCarico = membriCarico.map((m) => m.id);
  const [scarichiDettaglio, incassatoMese, guadagnoMese] =
    (isAdmin || isBackOffice) && !vuoto
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
    "mandato" | "perimetro" | "caricoMandato" | "caricoPerimetro" | "caricoMese" | "operatore" | "coda"
  > = {
    mandato: mandatoMonitorOk,
    perimetro: perimetroMonitorOk,
    caricoMandato: mandatoCaricoOk,
    caricoPerimetro: perimetroCaricoOk,
    caricoMese: caricoMeseRaw,
    operatore: selezionatoId,
    coda: codaRaw as AffidiNavParams["coda"],
  };
  const monitor =
    mostraMonitor && !vuoto
      ? await loadAffidiMonitoraggio(user, {
          mandanteId: mandatoMonitorOk,
          perimetro: perimetroMonitorOk,
        })
      : null;
  const monitorPanel =
    monitor && mostraMonitor ? (
      <AffidiMonitoraggioPanel
        mandanti={mandantiMonitor}
        monitor={monitor}
        mandatoId={mandatoMonitorOk}
        perimetro={perimetroMonitorOk}
        extraParams={monitorExtraParams}
      />
    ) : null;
  const caricoFiltriPanel =
    (isAdmin || isBackOffice) && !vuoto ? (
      <Card title="Filtri · incassi e pratiche per operatore">
        <AffidiCaricoFiltri
          mandanti={mandantiMonitor}
          operatori={membriCarico}
          caricoMandato={mandatoCaricoOk}
          caricoPerimetro={perimetroCaricoOk}
          caricoMese={caricoMeseRaw}
          operatoreId={selezionatoId}
          extraParams={caricoExtraParams}
        />
      </Card>
    ) : null;

  const filtraPerMandante = <T extends { mandanteId: string }>(rows: T[]) =>
    isBackOffice && mandatoRaw && !refPerimetro
      ? rows.filter((r) => r.mandanteId === mandatoRaw)
      : rows;

  const perimetriOverview =
    isBackOffice && mandatoRaw && !refPerimetro
      ? perimetriDisponibili.filter((r) => r.mandanteId === mandatoRaw)
      : perimetriDisponibili;

  const navPerimetro = refPerimetro
    ? { mandato: refPerimetro.mandanteId, perimetro: refPerimetro.perimetro }
    : undefined;

  const affidatePerimetro = refPerimetro
    ? filtraPratichePerPerimetro(affidate, refPerimetro)
    : filtraPerMandante(affidate);
  const daAssegnarePerimetro = refPerimetro
    ? filtraPratichePerPerimetro(daAssegnare, refPerimetro)
    : filtraPerMandante(daAssegnare);
  const praticheAffidabiliPerimetro = refPerimetro
    ? filtraPratichePerPerimetro(praticheAffidabili, refPerimetro)
    : filtraPerMandante(praticheAffidabili);
  const caricoPerimetro = refPerimetro
    ? buildCaricoOperatori(
        membriCarico,
        affidatePerimetro,
        new Date(),
        scarichiDettaglio?.perOperatore,
        incassatoMese?.perOperatore,
        guadagnoMese?.perOperatore
      )
    : buildCaricoOperatori(
        membriCarico,
        mostraMonitor
          ? affidateCarico
          : filtraPerMandante(affidate),
        new Date(),
        scarichiDettaglio?.perOperatore,
        incassatoMese?.perOperatore,
        guadagnoMese?.perOperatore
      );
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

  const mostraElenco =
    Boolean(selezionatoId || coda) &&
    (Boolean(refPerimetro) || isBackOffice || isAdmin);
  const praticheSelezionato = mostraElenco
    ? filtraPraticheAffido(
        refPerimetro
          ? affidatePerimetro
          : mostraMonitor
            ? affidateCarico
            : filtraPerMandante(affidate),
        { operatoreId: selezionatoId, coda }
      )
    : [];
  const titoloElenco = [
    refPerimetro
      ? `${refPerimetro.mandanteCodice} · ${refPerimetro.perimetro}`
      : isBackOffice && mandatoRaw
        ? mandantiOptions.find((m) => m.id === mandatoRaw)?.codice
        : null,
    selezionato
      ? `Pratiche di ${selezionato.name}`
      : refPerimetro
        ? "Pratiche del perimetro"
        : isBackOffice
          ? "Pratiche filtrate"
          : "Pratiche del gruppo",
    coda ? `· ${etichettaCodaAffidi(coda)}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const subtitle = isSupervisor
    ? refPerimetro
      ? `${refPerimetro.mandanteCodice} · ${refPerimetro.perimetro} · ${operatori.length} operatori · ${daAssegnarePerimetro.length} da affidare`
      : `Gruppo di ${user.name} · ${perimetriDisponibili.length} perimetri · ${operatori.length} operatori · ${daAssegnare.length} da affidare`
    : isBackOffice
      ? refPerimetro
        ? `${refPerimetro.mandanteCodice} · ${refPerimetro.perimetro} · ${operatori.length} operatori · ${daAssegnarePerimetro.length} da affidare`
        : mandatoRaw
          ? `${mandantiOptions.find((m) => m.id === mandatoRaw)?.codice ?? "Mandato"} · ${perimetriOverview.length} perimetri · ${daAssegnarePerimetro.length} da affidare`
          : `${mandantiOptions.length} mandati · ${perimetriDisponibili.length} perimetri · ${daAssegnare.length} da affidare`
      : `Assegna le pratiche nuove e monitora il carico operatori`;

  const praticheAffidabiliOverview = refPerimetro
    ? praticheAffidabiliPerimetro
    : filtraPerMandante(praticheAffidabili);
  const praticheAffidabiliMonitor = mostraMonitor
    ? filtraPraticheAffidiMonitor(praticheAffidabili, mandatoMonitorOk, perimetroMonitorOk)
    : praticheAffidabili;
  const daAssegnareMonitor = praticheAffidabiliMonitor.filter((p) => p.assegnatarioId == null);
  const daAssegnareOverview = refPerimetro ? daAssegnarePerimetro : filtraPerMandante(daAssegnare);

  const altriGruppi = isSupervisor
    ? await usersDbFromUser(user).findMany({
        where: {
          tenantId: user.tenantId,
          role: "SUPERVISOR",
          active: true,
          id: { not: user.id },
        },
        select: {
          id: true,
          name: true,
          gruppoNome: true,
          gruppoMandanti: true,
          operators: {
            where: { tenantId: user.tenantId, active: true, role: "OPERATOR" },
            select: { id: true, name: true },
            orderBy: { name: "asc" },
          },
        },
        orderBy: { name: "asc" },
      })
    : [];

  if (isVistaGruppo) {
    return (
      <div className="h-full min-h-0 space-y-4 overflow-y-auto pb-4">
        <PageHeader title="Affidi" subtitle={subtitle} />

        <Suspense fallback={null}>
          <AffidiIndietroLink />
          <AffidiScrollAffida />
        </Suspense>

        {caricoFiltriPanel}

        {isBackOffice ? (
          <Card title="Filtri">
            <AffidiFiltriBackOffice
              mandanti={mandantiOptions}
              perimetri={perimetriDisponibili}
              operatori={operatori}
              mandatoId={mandatoRaw}
              perimetro={refPerimetro?.perimetro}
              operatoreId={selezionatoId}
              coda={codaRaw}
            />
            <p className="mt-2 text-xs text-[var(--muted)]">
              Tutti i mandati e perimetri del tenant. Filtra per mandato, perimetro o operatore.
            </p>
          </Card>
        ) : (
          <Card
            title={
              gruppo.gruppoNome
                ? `Gruppo di lavoro · ${gruppo.gruppoNome}`
                : "Gruppo di lavoro"
            }
          >
            <GruppoInlineEditor
              supervisorId={user.id}
              membri={gruppo.members}
              gruppoNome={gruppo.gruppoNome}
              gruppoMandanti={gruppo.gruppoMandanti}
              mandanti={mandantiOptions}
              tuttiOperatori={tuttiOperatori.map((o) => ({
                id: o.id,
                name: o.name,
                supervisorId: o.supervisorId,
                supervisorName: o.supervisor?.name ?? null,
              }))}
              altriGruppi={altriGruppi}
            />
            <p className="mt-2 text-xs text-[var(--muted)]">
              Gli affidi riguardano solo pratiche nei mandati/perimetri assegnati al gruppo e gli
              operatori sotto {user.name}.
            </p>
          </Card>
        )}

        {isSupervisor && periCtx?.nessunPerimetroGruppo ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Nessun mandato/perimetro configurato sul gruppo: non compaiono pratiche da affidare.
            Configura mandanti e perimetri con <strong>Modifica gruppo</strong>.
          </p>
        ) : null}

        {refPerimetro ? (
          <>
            <Card
              id="affida"
              title={`Affida / riaffida · ${refPerimetro.mandanteCodice} · ${refPerimetro.perimetro}`}
            >
              {!praticheAffidabiliPerimetro.length ? (
                <p className="text-sm text-[var(--muted)]">Nessuna pratica nel perimetro.</p>
              ) : (
                <>
                  <p className="mb-3 text-xs text-[var(--muted)]">
                    {daAssegnarePerimetro.length} non assegnate ·{" "}
                    {praticheAffidabiliPerimetro.length - daAssegnarePerimetro.length} già affidate
                    (definitivo o temporaneo). Scegli tipo affido e operatore per ogni pratica o
                    usa la selezione massiva.
                  </p>
                  <AffidiDaAffidareTable
                    operatori={operatori}
                    pratiche={ordinaPraticheAffidabili(praticheAffidabiliPerimetro).map(
                      mapPraticaAffidabile
                    )}
                  />
                </>
              )}
            </Card>

            <Card title={`Pratiche per operatore · ${refPerimetro.mandanteCodice} · ${refPerimetro.perimetro}`}>
              {!caricoPerimetro.length ? (
                <p className="text-sm text-[var(--muted)]">Nessun operatore.</p>
              ) : (
                <>
                  {incassatoMese ? (
                    <div className="mb-5">
                      <p className="mb-2 text-xs text-[var(--muted)]">
                        Incassi · {filtroCaricoLabel} · Mese: {meseCaricoLabel}
                      </p>
                      <AffidiIncassiOperatori
                        righe={righeIncassoDaCarico(caricoPerimetro)}
                        selezionatoId={selezionatoId}
                        nav={{
                          ...navCarico,
                          mandato: refPerimetro.mandanteId,
                          perimetro: refPerimetro.perimetro,
                        }}
                        meseLabel={meseCaricoLabel}
                        totaleGruppo={incassatoMese.totale}
                        totaleGuadagno={guadagnoMese?.totale ?? 0}
                        annoCarico={annoCarico}
                        caricoMandato={mandatoCaricoOk}
                        caricoPerimetro={perimetroCaricoOk}
                        filtroCaricoLabel={filtroCaricoLabel}
                      />
                    </div>
                  ) : isSupervisor ? (
                    <AffidiFiltroOperatore
                      operatori={membriCarico}
                      selezionatoId={selezionatoId}
                      coda={codaRaw}
                      nav={{
                        mandato: refPerimetro.mandanteId,
                        perimetro: refPerimetro.perimetro,
                      }}
                    />
                  ) : null}
                  <p className="mb-2 text-xs text-[var(--muted)]">
                    Pratiche in carico
                    {scarichiGruppo ? ` · Codici scarico · Mese: ${meseCaricoLabel}` : ""}
                  </p>
                  <AffidiCaricoOperatori
                    carico={caricoPerimetro}
                    selezionatoId={selezionatoId}
                    coda={coda}
                    nav={{
                      ...navCarico,
                      mandato: refPerimetro.mandanteId,
                      perimetro: refPerimetro.perimetro,
                    }}
                    meseLabel={meseCaricoLabel}
                    scarichiGruppo={scarichiGruppo}
                  />
                  {mostraElenco ? (
                    <p className="mt-2 text-xs text-[var(--muted)]">
                      <Link href={buildAffidiHref(navPerimetro)} className="underline">
                        Chiudi dettaglio pratiche
                      </Link>
                    </p>
                  ) : (
                    <p className="mt-2 text-xs text-[var(--muted)]">
                      Clicca un numero o un operatore per le pratiche di questo perimetro.
                    </p>
                  )}
                </>
              )}
            </Card>

            {mostraElenco ? (
              <Card title={titoloElenco}>
                <AffidiPraticheOperatore
                  nome={titoloElenco}
                  pratiche={praticheSelezionato}
                  showAssegnatario={!selezionatoId}
                  operatori={operatori}
                />
              </Card>
            ) : null}
          </>
        ) : (
          <>
            {!refPerimetro && isBackOffice && (selezionatoId || coda) ? (
              <Card title="Pratiche per operatore">
                {incassatoMese ? (
                  <div className="mb-5">
                    <p className="mb-2 text-xs text-[var(--muted)]">
                      Incassi · {filtroCaricoLabel} · Mese: {meseCaricoLabel}
                    </p>
                    <AffidiIncassiOperatori
                      righe={righeIncassoDaCarico(caricoPerimetro)}
                      selezionatoId={selezionatoId}
                      nav={navCarico}
                      meseLabel={meseCaricoLabel}
                      totaleGruppo={incassatoMese.totale}
                      totaleGuadagno={guadagnoMese?.totale ?? 0}
                      annoCarico={annoCarico}
                      caricoMandato={mandatoCaricoOk}
                      caricoPerimetro={perimetroCaricoOk}
                      filtroCaricoLabel={filtroCaricoLabel}
                    />
                  </div>
                ) : null}
                <p className="mb-2 text-xs text-[var(--muted)]">
                  Pratiche in carico
                  {scarichiGruppo ? ` · Codici scarico · Mese: ${meseCaricoLabel}` : ""}
                </p>
                <AffidiCaricoOperatori
                  carico={caricoPerimetro}
                  selezionatoId={selezionatoId}
                  coda={coda}
                  nav={navCarico}
                  meseLabel={meseCaricoLabel}
                  scarichiGruppo={scarichiGruppo}
                />
              </Card>
            ) : null}

            {mostraElenco && !refPerimetro ? (
              <Card title={titoloElenco}>
                <AffidiPraticheOperatore
                  nome={titoloElenco}
                  pratiche={praticheSelezionato}
                  showAssegnatario={!selezionatoId}
                  operatori={operatori}
                />
              </Card>
            ) : null}

            <Card title="Affidi per mandato e perimetro">
              <AffidiPerimetroOverview
                refs={perimetriOverview}
                daAssegnare={daAssegnareOverview}
                affidate={filtraPerMandante(affidate)}
                membri={membriCarico}
              />
            </Card>

            <Card title="Affida / riaffida pratiche">
              {!praticheAffidabiliOverview.length ? (
                <p className="text-sm text-[var(--muted)]">
                  {isBackOffice
                    ? "Nessuna pratica con i filtri selezionati."
                    : "Nessuna pratica nei perimetri del gruppo."}
                </p>
              ) : (
                <>
                  <p className="mb-3 text-xs text-[var(--muted)]">
                    {daAssegnareOverview.length} non assegnate ·{" "}
                    {praticheAffidabiliOverview.length - daAssegnareOverview.length} già affidate
                    (definitivo o temporaneo). Puoi riaffidare anche quelle già in carico: seleziona
                    tipo affido e operatore.
                  </p>
                  <AffidiDaAffidareTable
                    operatori={operatori}
                    pratiche={ordinaPraticheAffidabili(praticheAffidabiliOverview).map(
                      mapPraticaAffidabile
                    )}
                  />
                </>
              )}
            </Card>
          </>
        )}

        {monitorPanel}
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 space-y-4 overflow-y-auto pb-4">
      <PageHeader title="Affidi" subtitle={subtitle} />

      {caricoFiltriPanel}

      {incassatoMese ? (
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
                filtroCaricoLabel={filtroCaricoLabel}
              />
            </>
          )}
        </Card>
      ) : null}

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

      {mostraElenco ? (
        <Card title={titoloElenco}>
          <AffidiPraticheOperatore
            nome={titoloElenco}
            pratiche={praticheSelezionato}
            showAssegnatario={!selezionatoId}
            operatori={operatori}
          />
        </Card>
      ) : null}

      {monitorPanel}

      <Card title="Affida / riaffida pratiche">
        {filtroMonitorLabel !== "Tutti i mandati e perimetri" ? (
          <p className="mb-2 text-xs text-[var(--muted)]">{filtroMonitorLabel}</p>
        ) : null}
        {!praticheAffidabiliMonitor.length ? (
          <p className="text-sm text-[var(--muted)]">Nessuna pratica con i filtri selezionati.</p>
        ) : (
          <>
            <p className="mb-3 text-xs text-[var(--muted)]">
              {daAssegnareMonitor.length} non assegnate ·{" "}
              {praticheAffidabiliMonitor.length - daAssegnareMonitor.length} già affidate (definitivo o
              temporaneo). Puoi riaffidare anche quelle già in carico.
            </p>
            <AffidiDaAffidareTable
              operatori={operatori}
              pratiche={ordinaPraticheAffidabili(praticheAffidabiliMonitor).map(mapPraticaAffidabile)}
            />
          </>
        )}
      </Card>
    </div>
  );
}
