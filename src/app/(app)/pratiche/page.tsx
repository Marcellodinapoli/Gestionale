import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/guard";
import { euro, dataIt } from "@/lib/domain";
import {
  filtraIdsPraticaScope,
  praticaScopeWhere,
  resolveGruppoPerimetroContext,
} from "@/lib/gruppoPerimetroScope";
import { esitoContattoLabel } from "@/lib/contatto";
import {
  buildPraticaCodaHref,
  codaFiltroWhere,
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
import { can } from "@/lib/permissions";
import { isAffidoTemporaneo } from "@/lib/affido";
import { codiceScaricoPratica } from "@/lib/scarico";
import { countRateScadute } from "@/lib/rate";

/** Stato predefinito all’apertura dell’elenco pratiche. */
const STATO_DEFAULT = "IN_LAVORAZIONE";

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
  const user = await requireUser();
  const sp = await searchParams;

  // Default: pratiche in lavorazione (stato assente in URL → applica filtro)
  if (!("stato" in sp)) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) {
      if (v != null && v !== "") params.set(k, v);
    }
    params.set("stato", STATO_DEFAULT);
    redirect(`/pratiche?${params.toString()}`);
  }

  const codaNav = parseCodaNav(sp);
  const altri = parseAltriFiltri(sp);
  const { page, pageSize } = paginateParams(sp.page);
  const periCtx = await resolveGruppoPerimetroContext(user);
  const baseScope = await praticaScopeWhere(user);

  const canFilterOp = ["ADMIN", "BACK_OFFICE", "AMMINISTRAZIONE", "SUPERVISOR"].includes(
    user.role
  );
  const needTemporanea =
    altri?.sitAffido === "temporanea" || altri?.affidoProvvisorio === "1";
  const needImportoTot = Boolean(altri?.importoTotDa || altri?.importoTotA);
  const needTotInc = Boolean(altri?.totIncassatoDa || altri?.totIncassatoA);

  const [operatoriListRaw, mandantiListRaw, temporaneaIdsRaw, lottiRows, importoTotIdsRaw, totIncassatoIdsRaw] =
    await Promise.all([
      canFilterOp
        ? prisma.user.findMany({
            where: {
              tenantId: user.tenantId,
              role: { in: ["OPERATOR", "SUPERVISOR"] },
              active: true,
              ...(user.role === "SUPERVISOR" && periCtx.memberIds.length
                ? { id: { in: periCtx.memberIds } }
                : {}),
            },
            orderBy: { name: "asc" },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
      prisma.mandante.findMany({
        where: { tenantId: user.tenantId },
        orderBy: { codice: "asc" },
        select: { id: true, codice: true, ragioneSociale: true },
      }),
      needTemporanea
        ? idsAffidoTemporaneo(user.tenantId)
        : Promise.resolve([] as string[]),
      prisma.pratica.groupBy({
        by: ["numeroMandante"],
        where: {
          AND: [
            baseScope,
            { numeroMandante: { not: null } },
            { stato: { notIn: [...STATI_PRATICA_CHIUSA] } },
          ],
        },
      }),
      needImportoTot
        ? idsImportoTotale(user.tenantId, altri?.importoTotDa, altri?.importoTotA)
        : Promise.resolve(null as string[] | null),
      needTotInc
        ? idsTotIncassato(user.tenantId, altri?.totIncassatoDa, altri?.totIncassatoA)
        : Promise.resolve(null as string[] | null),
    ]);

  const operatoriList = operatoriListRaw;
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

  const lottiInLavorazione = [
    ...new Set(
      lottiRows
        .map((r) => r.numeroMandante?.trim())
        .filter((v): v is string => Boolean(v))
    ),
  ].sort((a, b) => a.localeCompare(b, "it"));

  const altriWhere =
    altri && hasAltriFiltri(altri)
      ? altriFiltriWhere(
          canFilterOp ? altri : { ...altri, operatore: undefined },
          {
            canFilterOperatore: canFilterOp,
            temporaneaIds: temporaneaIds ?? undefined,
            importoTotIds: importoTotIds ?? undefined,
            totIncassatoIds: totIncassatoIds ?? undefined,
          }
        )
      : {};

  const where = {
    AND: [
      baseScope,
      ...(codaNav.filtro ? [codaFiltroWhere(codaNav.filtro)] : []),
      ...(Object.keys(altriWhere).length ? [altriWhere] : []),
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

  const total = await prisma.pratica.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const safeSkip = (safePage - 1) * pageSize;

  const pratiche = await prisma.pratica.findMany({
    where,
    include,
    orderBy: buildOrderBy(codaNav.sort, codaNav.dir),
    skip: safeSkip,
    take: pageSize,
  });

  const codaNavPagina = { ...codaNav, listPage: safePage };

  const queryBase: Record<string, string | boolean | number | undefined> = {
    q: sp.q,
    stato: sp.stato,
    esito: sp.esito,
    lavorate: codaNav.filtro?.lavorate,
    lavorateData: codaNav.filtro?.lavorateData,
    lavorateDa: codaNav.filtro?.lavorateDa,
    lavorateA: codaNav.filtro?.lavorateA,
    lavorateOggi: codaNav.filtro?.lavorateOggi,
    lavorateFascia: codaNav.filtro?.lavorateFascia,
    nonToccateDa: codaNav.filtro?.nonToccateDa,
    sort: codaNav.sort,
    dir: codaNav.dir,
    ...(altri || {}),
  };

  const sortBase = { ...queryBase };

  const apriPraticheHref = pratiche.length
    ? buildPraticaCodaHref(pratiche[0].id, codaNavPagina)
    : null;

  const canNotaMassiva = can(user, "pratiche:nota-massiva");

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
    return {
      id: p.id,
      numero: p.numero,
      stato: p.stato,
      residuoLabel: euro(p.residuo),
      esitoLabel: esitoContattoLabel(p.esitoContatto),
      ultimaLavorazioneLabel: dataIt(p.ultimaLavorazioneAt ?? null),
      debitoreNome: `${p.debitore.nome} ${p.debitore.cognome}`,
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
      codScarico: codiceScaricoPratica(p.stato, p.codiceScarico),
      affidoProvvisorio: isAffidoTemporaneo(p),
      importoRataLabel: primaRataAperta ? euro(primaRataAperta.importo) : "—",
      rateScaduteLabel: nRateScadute > 0 ? String(nRateScadute) : "—",
      totIncassatoLabel: euro(totInc),
      importoTotaleLabel: euro(impTot),
      garanteLabel: g ? `${g.nome} ${g.cognome}`.trim() : "—",
      href: buildPraticaCodaHref(p.id, codaNavPagina),
    };
  });

  return (
    <div className="flex h-full min-h-0 flex-col pb-4">
      <PageHeader
        title="Pratiche"
        subtitle={
          periCtx.nessunPerimetroGruppo
            ? "Nessun perimetro configurato sul gruppo — imposta mandanti e perimetri in Affidi"
            : user.role === "OPERATOR"
              ? `${total} posizioni nei perimetri del gruppo`
              : user.role === "SUPERVISOR"
                ? `${total} nei perimetri del gruppo`
                : `${total} visibili`
        }
      />
      {periCtx.nessunPerimetroGruppo ? (
        <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Nessun perimetro impostato sul gruppo: filtri e elenco pratiche restano vuoti finché non
          configuri mandanti e perimetri in{" "}
          <Link href="/affidi" className="font-semibold underline">
            Affidi
          </Link>
          .
        </p>
      ) : null}
      <PraticheFiltriBar
        q={sp.q}
        stato={sp.stato}
        esito={sp.esito}
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
        altri={altri}
      />
      {apriPraticheHref ? (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Link
            href={apriPraticheHref}
            prefetch
            className="inline-flex h-10 items-center rounded-lg bg-[var(--navy)] px-4 text-sm font-semibold text-white shadow-sm hover:opacity-90"
          >
            Apri pratiche
          </Link>
        </div>
      ) : null}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <PraticheListaConNotaMassiva
          pratiche={praticheRows}
          sortColumns={sortColumns}
          canNotaMassiva={canNotaMassiva}
        />
        {total > 0 ? (
          <PaginazioneBar
            page={safePage}
            totalPages={totalPages}
            hrefForPage={(p) => buildPraticheQuery({ ...queryBase, page: p })}
            right={
              <span className="text-xs text-[var(--muted)]">
                {Math.min(safeSkip + 1, total)}–
                {Math.min(safeSkip + PRATICHE_PAGE_SIZE, total)} di {total}
              </span>
            }
          />
        ) : null}
      </div>
    </div>
  );
}
