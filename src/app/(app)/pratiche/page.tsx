import Link from "next/link";
import { redirect } from "next/navigation";
import { mandantiDbFromUser } from "@/lib/mandantiRepo";
import { usersDbFromUser } from "@/lib/usersRepo";
import { praticaDbFromUser, idsAffidoTemporaneoForTenant, idsImportoTotaleForTenant, idsTotIncassatoForTenant, praticaDb, type PraticaDbContext } from "@/lib/praticheRepo";
import { requireNavPage } from "@/lib/guard";
import { euro, dataIt } from "@/lib/domain";
import {
  filtraIdsPraticaScope,
  praticaCercaScopeWhere,
  praticaScopeWhere,
  resolveGruppoPerimetroContext,
} from "@/lib/gruppoPerimetroScope";
import { esitoContattoLabel } from "@/lib/contatto";
import {
  buildPraticaCodaHref,
  codaFiltroWhere,
  hasRicercaAnagrafica,
  parseCodaNav,
} from "@/lib/praticaCoda";
import {
  altriFiltriWhere,
  hasAltriFiltri,
  idsAffidoTemporaneo,
  idsImportoTotale,
  idsTotIncassato,
  parseAltriFiltri,
} from "@/lib/praticheAltriFiltri";
import { STATI_PRATICA_CHIUSA } from "@/lib/praticheInattive";
import {
  buildOrderBy,
  SORT_COLUMNS,
  type SortDir,
  type SortField,
} from "@/lib/praticaOrdine";
import { PageHeader } from "@/components/ui";
import {
  buildPraticheQuery,
  paginateParams,
  PaginazioneBar,
  PRATICHE_PAGE_SIZE,
} from "@/components/PaginazioneBar";
import { PraticheFiltriBar } from "@/components/pratiche/PraticheFiltriBar";
import { PraticheListaConNotaMassiva } from "@/components/pratiche/PraticheListaConNotaMassiva";
import { PraticheFiltriAttiviRiepilogo } from "@/components/pratiche/PraticheFiltriAttiviRiepilogo";
import {
  PraticheConteggiProvider,
  PraticheConteggiSubtitle,
} from "@/components/pratiche/PraticheConteggi";
import { can } from "@/lib/permissions";
import { isAffidoTemporaneo } from "@/lib/affido";
import { codiceScaricoPratica } from "@/lib/scarico";
import { countRateScadute } from "@/lib/rate";
import { parseFiltroSrc } from "@/lib/filtroVeloceEsclusivo";
import {
  canUseOperatoreFiltro,
  memberIdsOperatoreFiltro,
} from "@/lib/filtriOperatore";
import {
  statoOperativoPratica,
} from "@/lib/statoOperativoPratica";
import {
  PREAVVISO_STRAGIUDIZIALE_PARAM,
  isPreavvisoStragiudiziale,
  scadenzaStragiudizialeEffettiva,
  wherePreavvisoStragiudiziale,
} from "@/lib/scadenzaStragiudiziale";
import {
  ATTIVITA_GIUDIZIALE_PARAM,
  whereAttivitaGiudiziale,
} from "@/lib/giudiziale/avvioGiudiziale";

function buildSortHref(
  base: Record<string, string | boolean | number | undefined>,
  sort: SortField,
  currentSort: SortField,
  currentDir: SortDir
) {
  const nextDir = sort === currentSort && currentDir === "asc" ? "desc" : "asc";
  return buildPraticheQuery({ ...base, sort, dir: nextDir, page: undefined });
}

export default async function PratichePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireNavPage("pratiche");
  const sp = await searchParams;

  const preavvisoAttivo = sp[PREAVVISO_STRAGIUDIZIALE_PARAM] === "1";
  const attivitaGiudizialeAttivo = sp[ATTIVITA_GIUDIZIALE_PARAM] === "1";
  const elencoSpecialeAttivo = preavvisoAttivo || attivitaGiudizialeAttivo;
  const qRicerca = sp.q?.trim() || "";

  // Apertura senza «Filtra/Applica»: nessun filtro in URL (tutti i ruoli).
  // Evita residui di ex-default stato/operatore per supervisor e operatori.
  if (!elencoSpecialeAttivo && sp.cerca !== "1") {
    const hasParams = Object.values(sp).some(
      (v) => v != null && String(v).trim() !== ""
    );
    if (hasParams) redirect("/pratiche");
  }

  // Ricerca generica: non limitare per stato/operatore preimpostati.
  const needsStatoTuttiPerRicerca =
    Boolean(qRicerca) && !elencoSpecialeAttivo && Boolean(sp.stato) && sp.stato !== "TUTTI";
  const needsClearOperatorePerRicerca =
    Boolean(qRicerca) && Boolean(sp.operatore?.trim());

  if (needsStatoTuttiPerRicerca || needsClearOperatorePerRicerca) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) {
      if (v == null || v === "") continue;
      if (k === "stato") continue;
      if (k === "operatore" && (qRicerca || needsClearOperatorePerRicerca)) continue;
      if (k === "operatoreOp" && (qRicerca || needsClearOperatorePerRicerca)) continue;
      params.set(k, v);
    }
    if (needsStatoTuttiPerRicerca) {
      params.set("stato", "TUTTI");
    } else if (sp.stato) {
      params.set("stato", sp.stato);
    }
    redirect(`/pratiche?${params.toString()}`);
  }

  const praticaModel = praticaDbFromUser(user);

  const codaNavRaw = parseCodaNav(sp);
  const codaNav = elencoSpecialeAttivo
    ? {
        ...codaNavRaw,
        filtro: codaNavRaw.filtro
          ? { ...codaNavRaw.filtro, stato: undefined }
          : codaNavRaw.filtro,
      }
    : codaNavRaw;
  // Elenco solo dopo Filtra / Applica (cerca=1) o elenchi speciali (preavviso / giudiziale).
  const showElenco = sp.cerca === "1" || elencoSpecialeAttivo;
  const altri = parseAltriFiltri(sp);
  const { page, pageSize } = paginateParams(sp.page);
  const periCtx = await resolveGruppoPerimetroContext(user);
  const qTrim = (typeof sp.q === "string" ? sp.q : Array.isArray(sp.q) ? sp.q[0] : "")?.trim() || "";
  const ricercaAnagrafica =
    Boolean(qTrim) || hasRicercaAnagrafica({ q: qTrim || sp.q, altri });
  // Ricerca anagrafica: scope ampio (altre pratiche, non solo portfolio / operatore).
  const baseScope = ricercaAnagrafica
    ? await praticaCercaScopeWhere(user)
    : await praticaScopeWhere(user);

  const canUseOperatoreFiltroUi = canUseOperatoreFiltro(user.role);
  const needTemporanea =
    altri?.sitAffido === "temporanea" || altri?.affidoProvvisorio === "1";
  const needImportoTot = Boolean(altri?.importoTotDa || altri?.importoTotA);
  const needTotInc = Boolean(altri?.totIncassatoDa || altri?.totIncassatoA);

  const praticaCtx: PraticaDbContext = {
    tenantId: user.tenantId,
    tenantSlug: user.tenantSlug ?? user.tenantId,
    // Ricerca anagrafica: scope ADMIN + skipRoleScope (niente portfolio / stragiudiziale / perimetro).
    role: ricercaAnagrafica ? "ADMIN" : user.role,
    userId: user.id,
    skipRoleScope: ricercaAnagrafica,
  };
  // Sempre praticaDb con ctx dedicato in ricerca (evita scope SUPERVISOR/stragiudiziale).
  const praticaQuery = praticaDb(praticaCtx);

  const operatoriScopeIds = memberIdsOperatoreFiltro(
    user.role,
    user.id,
    periCtx.memberIds
  );

  const [operatoriListRaw, meRaw, mandantiListRaw, temporaneaIdsRaw, lottiRows, importoTotIdsRaw, totIncassatoIdsRaw] =
    await Promise.all([
      canUseOperatoreFiltroUi
        ? usersDbFromUser(user).findMany({
            where: {
              tenantId: user.tenantId,
              role: { in: ["OPERATOR", "SUPERVISOR"] },
              active: true,
              ...(operatoriScopeIds ? { id: { in: operatoriScopeIds } } : {}),
            },
            orderBy: { name: "asc" },
            select: { id: true, name: true, acronimo: true },
          })
        : Promise.resolve([]),
      usersDbFromUser(user).findUnique({
        where: { id: user.id },
        select: { id: true, name: true, acronimo: true },
      }),
      mandantiDbFromUser(user).findMany({
        where: { tenantId: user.tenantId },
        orderBy: { codice: "asc" },
        select: { id: true, codice: true, ragioneSociale: true, perimetri: true },
      }),
      needTemporanea
        ? idsAffidoTemporaneo(praticaCtx)
        : Promise.resolve([] as string[]),
      praticaModel.groupBy({
        by: ["mandanteId", "numeroMandante"],
        where: {
          AND: [
            baseScope,
            { numeroMandante: { not: null } },
            { stato: { notIn: [...STATI_PRATICA_CHIUSA] } },
          ],
        },
      }),
      needImportoTot
        ? idsImportoTotale(praticaCtx, altri?.importoTotDa, altri?.importoTotA)
        : Promise.resolve(null as string[] | null),
      needTotInc
        ? idsTotIncassato(praticaCtx, altri?.totIncassatoDa, altri?.totIncassatoA)
        : Promise.resolve(null as string[] | null),
    ]);

  const operatoriList = (() => {
    const byId = new Map<string, { id: string; name: string; acronimo: string | null }>();
    for (const o of operatoriListRaw) {
      byId.set(o.id, {
        id: o.id,
        name: o.name,
        acronimo: o.acronimo ?? null,
      });
    }
    if (meRaw && canUseOperatoreFiltroUi) {
      byId.set(meRaw.id, {
        id: meRaw.id,
        name: meRaw.name,
        acronimo: meRaw.acronimo ?? null,
      });
    }
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, "it"));
  })();
  const mandantiList =
    periCtx.nelGruppo && periCtx.gruppoMandanti.length
      ? mandantiListRaw.filter((m) =>
          periCtx.gruppoMandanti.some((a) => a.mandanteId === m.id)
        )
      : mandantiListRaw;
  const temporaneaIds = needTemporanea
    ? await filtraIdsPraticaScope(user, temporaneaIdsRaw)
    : undefined;
  const importoTotIds =
    importoTotIdsRaw != null
      ? await filtraIdsPraticaScope(user, importoTotIdsRaw)
      : undefined;
  const totIncassatoIds =
    totIncassatoIdsRaw != null
      ? await filtraIdsPraticaScope(user, totIncassatoIdsRaw)
      : undefined;

  const lottiPerMandato: Record<string, string[]> = {};
  const lottiInLavorazioneSet = new Set<string>();
  for (const row of lottiRows) {
    const lotto = row.numeroMandante?.trim();
    if (!lotto) continue;
    lottiInLavorazioneSet.add(lotto);
    const list = lottiPerMandato[row.mandanteId] ?? [];
    if (!list.includes(lotto)) list.push(lotto);
    lottiPerMandato[row.mandanteId] = list;
  }
  for (const id of Object.keys(lottiPerMandato)) {
    lottiPerMandato[id]!.sort((a, b) => a.localeCompare(b, "it"));
  }
  const lottiInLavorazione = [...lottiInLavorazioneSet].sort((a, b) =>
    a.localeCompare(b, "it")
  );

  const mandantiPerimetri = mandantiList.map((m) => ({
    id: m.id,
    perimetri: m.perimetri,
  }));

  const altriWhere =
    altri && hasAltriFiltri(altri)
      ? altriFiltriWhere(
          // In ricerca anagrafica ignora il default operatore (supervisor/operatore):
          // altrimenti le «Nuove» senza assegnatario non compaiono mai.
          ricercaAnagrafica
            ? { ...altri, operatore: undefined, operatoreOp: undefined }
            : altri,
          {
            canFilterOperatore: canUseOperatoreFiltroUi,
            temporaneaIds: temporaneaIds ?? undefined,
            importoTotIds: importoTotIds ?? undefined,
            totIncassatoIds: totIncassatoIds ?? undefined,
            mandantiPerimetri,
          }
        )
      : {};

  const where = {
    AND: [
      baseScope,
      ...(codaNav.filtro ? [codaFiltroWhere(codaNav.filtro)] : []),
      ...(Object.keys(altriWhere).length ? [altriWhere] : []),
      ...(sp[PREAVVISO_STRAGIUDIZIALE_PARAM] === "1"
        ? [wherePreavvisoStragiudiziale()]
        : []),
      ...(sp[ATTIVITA_GIUDIZIALE_PARAM] === "1"
        ? [whereAttivitaGiudiziale()]
        : []),
    ],
  };

  const include = {
    debitore: {
      select: {
        nome: true,
        cognome: true,
        telefono: true,
        cap: true,
        citta: true,
        provincia: true,
        codiceFiscale: true,
      },
    },
    mandante: { select: { codice: true } },
    assegnatario: { select: { name: true } },
    rate: {
      orderBy: { numeroRata: "asc" as const },
      select: { importo: true, pagata: true, scadenza: true },
    },
    incassi: { select: { importo: true } },
    garanti: {
      orderBy: { ordine: "asc" as const },
      take: 1,
      select: { nome: true, cognome: true },
    },
  };

  const canNotaMassiva = can(user, "pratiche:nota-massiva");

  const total = showElenco ? await praticaQuery.count({ where }) : 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const safeSkip = (safePage - 1) * pageSize;

  const [pratiche, tutteIdsRows] = showElenco
    ? await Promise.all([
        praticaQuery.findMany({
          where,
          include,
          orderBy: buildOrderBy(codaNav.sort, codaNav.dir),
          skip: safeSkip,
          take: pageSize,
        }),
        canNotaMassiva && total > 0
          ? praticaQuery.findMany({
              where,
              select: { id: true },
              // Senza orderBy: più veloce; serve solo per la selezione massiva.
            })
          : Promise.resolve([] as Array<{ id: string }>),
      ])
    : [[], [] as Array<{ id: string }>];

  const tutteIds = tutteIdsRows.map((r) => r.id);
  const codaNavPagina = { ...codaNav, listPage: safePage };

  const queryBase: Record<string, string | boolean | number | undefined> = {
    q: sp.q,
    stato: sp.stato,
    esito: sp.esito,
    cerca: showElenco ? "1" : undefined,
    lavorate: codaNav.filtro?.lavorate,
    lavorateData: codaNav.filtro?.lavorateData,
    lavorateDa: codaNav.filtro?.lavorateDa,
    lavorateA: codaNav.filtro?.lavorateA,
    lavorateOggi: codaNav.filtro?.lavorateOggi,
    lavorateFascia: codaNav.filtro?.lavorateFascia,
    nonToccateDa: codaNav.filtro?.nonToccateDa,
    sort: codaNav.sort,
    dir: codaNav.dir,
    filtroSrc: parseFiltroSrc(sp) ?? undefined,
    ...(altri || {}),
    ...(sp[PREAVVISO_STRAGIUDIZIALE_PARAM] === "1"
      ? { [PREAVVISO_STRAGIUDIZIALE_PARAM]: "1" }
      : {}),
    ...(sp[ATTIVITA_GIUDIZIALE_PARAM] === "1"
      ? { [ATTIVITA_GIUDIZIALE_PARAM]: "1" }
      : {}),
  };

  const sortBase = { ...queryBase };

  const pageIds = pratiche.map((p) => p.id);

  const apriPraticheHref = pratiche.length
    ? buildPraticaCodaHref(pratiche[0].id, codaNavPagina, pageIds)
    : null;

  const sortColumns = SORT_COLUMNS.map((col) => {
    const active = codaNav.sort === col.key;
    return {
      key: col.key,
      label: col.label,
      href: buildSortHref(sortBase, col.key, codaNav.sort, codaNav.dir),
      active,
      arrow: active ? (codaNav.dir === "asc" ? " ▲" : " ▼") : "",
    };
  });

  const praticheRows = pratiche.map((p) => {
    const totInc = p.incassi.reduce((s, i) => s + (i.importo || 0), 0);
    const impTot = (p.capitale || 0) + (p.interessi || 0) + (p.spese || 0);
    const g = p.garanti[0];
    const primaRataAperta = p.rate.find((r) => !r.pagata);
    const nRateScadute = countRateScadute(p.rate);
    const scadStrag = scadenzaStragiudizialeEffettiva({
      scadenza: p.scadenza,
      dataPassaggioGiudiziale: p.dataPassaggioGiudiziale,
      conferimentoTipo: p.conferimentoTipo,
    });
    return {
      id: p.id,
      numero: p.numero,
      stato: statoOperativoPratica({
        stato: p.stato,
        assegnatarioId: p.assegnatarioId,
        scadenza: p.scadenza,
        codiceScaricoBk: p.codiceScaricoBk,
      }),
      residuoLabel: euro(p.residuo),
      esitoLabel: esitoContattoLabel(p.esitoContatto),
      ultimaLavorazioneLabel: dataIt(p.ultimaLavorazioneAt ?? null),
      debitoreNome: `${p.debitore.cognome} ${p.debitore.nome}`.trim(),
      debitoreTelefono: p.debitore.telefono,
      debitoreCap: p.debitore.cap,
      debitoreCitta: p.debitore.citta,
      debitoreProv: p.debitore.provincia,
      debitoreCf: p.debitore.codiceFiscale,
      mandanteCodice: p.mandante.codice,
      assegnatarioNome: p.assegnatario?.name ?? null,
      lotto: p.numeroMandante,
      dataAffidoLabel: dataIt(p.dataAffido),
      scadenzaLabel: dataIt(p.scadenza),
      scadenzaStragiudizialeLabel: dataIt(scadStrag),
      preavvisoStragiudiziale: isPreavvisoStragiudiziale(scadStrag),
      codScarico: codiceScaricoPratica(p.stato, p.codiceScarico),
      affidoProvvisorio: isAffidoTemporaneo(p),
      importoRataLabel: primaRataAperta ? euro(primaRataAperta.importo) : "—",
      rateScaduteLabel: nRateScadute > 0 ? String(nRateScadute) : "—",
      totIncassatoLabel: euro(totInc),
      importoTotaleLabel: euro(impTot),
      garanteLabel: g ? `${g.cognome} ${g.nome}`.trim() : "—",
      href: buildPraticaCodaHref(p.id, codaNavPagina, pageIds),
    };
  });

  return (
    <PraticheConteggiProvider totale={total}>
    <div className="flex h-full min-h-0 flex-col pb-4">
      <PageHeader
        title="Pratiche"
        subtitle={
          !showElenco
            ? "Imposta i filtri e clicca Filtra per vedere l’elenco"
            : user.role === "OPERATOR"
              ? `${total} posizioni${ricercaAnagrafica ? " (ricerca tenant)" : periCtx.nelGruppo ? " nei perimetri del gruppo" : ""}`
              : user.role === "SUPERVISOR"
                ? `${total}${ricercaAnagrafica ? " (ricerca tenant)" : periCtx.nelGruppo ? " nei perimetri del gruppo" : ""}`
                : (
                    <PraticheConteggiSubtitle
                      showSelezione={canNotaMassiva}
                      fallback={`${total} visibili`}
                    />
                  )
        }
      />
      {preavvisoAttivo ? (
        <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          Elenco filtrato: pratiche in dirittura di scadenza stragiudiziale (entro 10
          giorni lavorativi) o già scadute, ancora aperte.{" "}
          <Link href="/pratiche" className="font-semibold underline">
            Torna all&apos;elenco completo
          </Link>
        </p>
      ) : null}
      {attivitaGiudizialeAttivo ? (
        <p className="mb-3 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-950">
          Elenco filtrato: pratiche già in attività giudiziale (valutazione / strategia).{" "}
          <Link href="/pratiche" className="font-semibold underline">
            Torna all&apos;elenco completo
          </Link>
        </p>
      ) : null}
      <PraticheFiltriBar
        q={sp.q}
        stato={elencoSpecialeAttivo ? undefined : sp.stato}
        nascondiFiltroStato={user.role === "OPERATOR"}
        lavorate={codaNav.filtro?.lavorate}
        lavorateData={codaNav.filtro?.lavorateData}
        lavorateDa={codaNav.filtro?.lavorateDa}
        lavorateA={codaNav.filtro?.lavorateA}
        lavorateOggi={codaNav.filtro?.lavorateOggi}
        lavorateFascia={codaNav.filtro?.lavorateFascia}
        nonToccateDa={codaNav.filtro?.nonToccateDa}
        sort={codaNav.sort}
        dir={codaNav.dir}
        operatori={operatoriList}
        mandanti={mandantiList}
        lotti={lottiInLavorazione}
        lottiPerMandato={lottiPerMandato}
        mandantiPerimetri={mandantiPerimetri}
        altri={altri}
        apriPraticheHref={apriPraticheHref}
        searchActive={showElenco}
        searchParams={sp}
      />
      {showElenco ? (
        <div className="mt-1.5 shrink-0 rounded-lg border border-[var(--line)] bg-[#eef3f8] px-2.5 py-1.5">
          <PraticheFiltriAttiviRiepilogo
            className="text-xs leading-snug text-[var(--navy)]"
            q={sp.q}
            stato={elencoSpecialeAttivo ? undefined : sp.stato}
            lavorateDa={codaNav.filtro?.lavorateDa}
            lavorateA={codaNav.filtro?.lavorateA}
            lavorateData={codaNav.filtro?.lavorateData}
            lavorateOggi={codaNav.filtro?.lavorateOggi}
            lavorateFascia={codaNav.filtro?.lavorateFascia}
            nonToccateDa={codaNav.filtro?.nonToccateDa}
            altri={altri}
            filtroSrc={parseFiltroSrc(sp)}
            operatori={operatoriList}
            mandanti={mandantiList}
          />
        </div>
      ) : null}
      {!showElenco ? (
        <div className="mt-4 rounded-xl border border-[var(--line)] bg-white px-4 py-10 text-center text-sm text-[var(--muted)]">
          Nessun elenco caricato. Imposta i filtri in Filtro veloce e premi{" "}
          <span className="font-semibold text-[var(--navy)]">Filtra</span>, oppure usa{" "}
          <span className="font-semibold text-[var(--navy)]">Tutti i filtri</span>.
        </div>
      ) : (
      <div className="mt-2 flex min-h-0 flex-1 flex-col overflow-hidden">
        <PraticheListaConNotaMassiva
          pratiche={praticheRows}
          sortColumns={sortColumns}
          canNotaMassiva={canNotaMassiva}
          tutteIds={canNotaMassiva ? tutteIds : undefined}
          totaleFiltro={total}
        />
        {total > 0 ? (
          <PaginazioneBar
            page={safePage}
            totalPages={totalPages}
            hrefForPage={(p) => buildPraticheQuery({ ...queryBase, page: p })}
            right={
              <span className="text-xs font-semibold tabular-nums text-[var(--navy)]">
                {Math.min(safeSkip + PRATICHE_PAGE_SIZE, total)}/{total}
              </span>
            }
          />
        ) : null}
      </div>
      )}
    </div>
    </PraticheConteggiProvider>
  );
}
