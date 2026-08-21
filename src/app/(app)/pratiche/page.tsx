import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/guard";
import { praticaWhere, euro, dataIt } from "@/lib/domain";
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
  isUltimaLavorazioneSort,
  orderPraticaIdsByUltimaLavorazione,
  SORT_COLUMNS,
  type SortDir,
  type SortField,
  ultimaLavorazioneInclude,
} from "@/lib/praticaOrdine";
import { PageHeader } from "@/components/ui";
import {
  PaginazioneBar,
  buildPraticheQuery,
  paginateParams,
} from "@/components/PaginazioneBar";
import { PraticheFiltriBar } from "@/components/pratiche/PraticheFiltriBar";
import { PraticheListaConNotaMassiva } from "@/components/pratiche/PraticheListaConNotaMassiva";
import { can } from "@/lib/permissions";
import { isAffidoTemporaneo } from "@/lib/affido";
import { codiceScaricoPratica } from "@/lib/scarico";

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
  const codaNav = parseCodaNav(sp);
  const { page, pageSize, skip } = paginateParams(sp.page);
  const altri = parseAltriFiltri(sp);

  const canFilterOp = ["ADMIN", "BACK_OFFICE", "AMMINISTRAZIONE", "SUPERVISOR"].includes(
    user.role
  );
  const needTemporanea =
    altri?.sitAffido === "temporanea" || altri?.affidoProvvisorio === "1";

  const [operatoriList, mandantiList, temporaneaIds, lottiRows, importoTotIds, totIncassatoIds] =
    await Promise.all([
      canFilterOp
        ? prisma.user.findMany({
            where: {
              tenantId: user.tenantId,
              role: { in: ["OPERATOR", "SUPERVISOR"] },
              active: true,
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
            praticaWhere(user),
            { numeroMandante: { not: null } },
            { stato: { notIn: [...STATI_PRATICA_CHIUSA] } },
          ],
        },
      }),
      idsImportoTotale(user.tenantId, altri?.importoTotDa, altri?.importoTotA),
      idsTotIncassato(user.tenantId, altri?.totIncassatoDa, altri?.totIncassatoA),
    ]);

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
            temporaneaIds,
            importoTotIds,
            totIncassatoIds,
          }
        )
      : {};

  const where = {
    AND: [
      praticaWhere(user),
      ...(codaNav.filtro ? [codaFiltroWhere(codaNav.filtro)] : []),
      ...(Object.keys(altriWhere).length ? [altriWhere] : []),
    ],
  };

  const include = {
    debitore: true,
    mandante: true,
    assegnatario: true,
    attivita: ultimaLavorazioneInclude,
    rate: { orderBy: { numeroRata: "asc" as const }, take: 1 },
    incassi: { select: { importo: true } },
    garanti: {
      orderBy: { ordine: "asc" as const },
      take: 1,
      select: { nome: true, cognome: true },
    },
  };

  const total = await prisma.pratica.count({ where });
  let pratiche: Array<{
    id: string;
    numero: string;
    stato: string;
    residuo: number;
    capitale: number;
    interessi: number;
    spese: number;
    esitoContatto: string | null;
    numeroMandante: string | null;
    codiceScarico: string | null;
    dataAffido: Date | null;
    scadenza: Date | null;
    assegnatarioId: string | null;
    operatoreTitolareId: string | null;
    debitore: {
      nome: string;
      cognome: string;
      telefono: string | null;
      cap: string | null;
      citta: string | null;
      provincia: string | null;
      codiceFiscale: string | null;
    };
    mandante: { codice: string };
    assegnatario: { name: string } | null;
    attivita: Array<{ createdAt: Date }>;
    rate: Array<{ importo: number }>;
    incassi: Array<{ importo: number }>;
    garanti: Array<{ nome: string; cognome: string }>;
  }>;

  if (isUltimaLavorazioneSort(codaNav.sort)) {
    const ids = await orderPraticaIdsByUltimaLavorazione(
      where,
      codaNav.dir,
      skip,
      pageSize
    );
    if (!ids.length) {
      pratiche = [];
    } else {
      const rows = await prisma.pratica.findMany({
        where: { id: { in: ids } },
        include,
      });
      const byId = new Map(rows.map((p) => [p.id, p]));
      pratiche = ids.map((id) => byId.get(id)!).filter(Boolean);
    }
  } else {
    pratiche = await prisma.pratica.findMany({
      where,
      include,
      orderBy: buildOrderBy(codaNav.sort, codaNav.dir),
      skip,
      take: pageSize,
    });
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const codaNavPagina = { ...codaNav, listPage: safePage };

  const queryBase: Record<string, string | boolean | number | undefined> = {
    q: sp.q,
    stato: sp.stato,
    esito: sp.esito,
    lavorate: codaNav.filtro?.lavorate,
    lavorateData: codaNav.filtro?.lavorateData,
    lavorateOggi: codaNav.filtro?.lavorateOggi,
    lavorateFascia: codaNav.filtro?.lavorateFascia,
    nonToccateDa: codaNav.filtro?.nonToccateDa,
    sort: codaNav.sort,
    dir: codaNav.dir,
    ...(altri || {}),
  };

  const hrefForPage = (p: number) =>
    buildPraticheQuery({ ...queryBase, page: p });

  const sortBase = { ...queryBase, page: safePage };

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
    return {
      id: p.id,
      numero: p.numero,
      stato: p.stato,
      residuoLabel: euro(p.residuo),
      esitoLabel: esitoContattoLabel(p.esitoContatto),
      ultimaLavorazioneLabel: dataIt(p.attivita[0]?.createdAt ?? null),
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
      importoRataLabel: p.rate[0] ? euro(p.rate[0].importo) : "—",
      totIncassatoLabel: euro(totInc),
      importoTotaleLabel: euro(impTot),
      garanteLabel: g ? `${g.nome} ${g.cognome}`.trim() : "—",
      href: buildPraticaCodaHref(p.id, codaNavPagina),
    };
  });

  return (
    <div className="flex h-full min-h-0 flex-col pb-14">
      <PageHeader
        title="Pratiche"
        subtitle={
          user.role === "OPERATOR"
            ? `${total} posizioni affidate · pagina ${safePage}/${totalPages}`
            : user.role === "SUPERVISOR"
              ? `${total} del gruppo (operatori + da affidare) · pagina ${safePage}/${totalPages}`
              : `${total} visibili · pagina ${safePage}/${totalPages}`
        }
      />
      <PraticheFiltriBar
        q={sp.q}
        stato={sp.stato}
        esito={sp.esito}
        lavorate={codaNav.filtro?.lavorate}
        lavorateData={codaNav.filtro?.lavorateData}
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
            className="inline-flex h-10 items-center rounded-lg bg-[var(--navy)] px-4 text-sm font-semibold text-white shadow-sm hover:opacity-90"
          >
            Apri pratiche
          </Link>
          <p className="text-xs text-[var(--muted)]">
            Apre la prima pratica di questa pagina · le frecce seguono l&apos;ordine filtrato
          </p>
        </div>
      ) : null}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <PraticheListaConNotaMassiva
          pratiche={praticheRows}
          sortColumns={sortColumns}
          canNotaMassiva={canNotaMassiva}
          altri={altri}
          operatori={operatoriList}
          mandanti={mandantiList}
          lotti={lottiInLavorazione}
          navHidden={{
            q: sp.q,
            stato: sp.stato,
            esito: sp.esito,
            lavorateData: codaNav.filtro?.lavorateData,
            lavorateFascia: codaNav.filtro?.lavorateFascia,
            sort: codaNav.sort,
            dir: codaNav.dir,
          }}
        />
      </div>
      <PaginazioneBar
        fixed
        page={safePage}
        totalPages={totalPages}
        hrefForPage={hrefForPage}
      />
    </div>
  );
}
