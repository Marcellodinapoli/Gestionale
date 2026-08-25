import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/guard";
import { can } from "@/lib/permissions";
import {
  canAccessPratica,
  praticaWhere,
  praticheStessoDebitoreIds,
} from "@/lib/domain";
import {
  buildPraticaCollegataHref,
  parseFiltroCollegata,
  parsePraticaOrigine,
} from "@/lib/praticaCollegata";
import {
  buildPraticaCodaHref,
  codaFiltroWhere,
  hasCodaNavParams,
  parseCodaNav,
  type CodaNav,
} from "@/lib/praticaCoda";
import { buildOrderBy, isUltimaLavorazioneSort, orderPraticaIdsByUltimaLavorazione } from "@/lib/praticaOrdine";
import { getRecordingMode } from "@/lib/recordingConfig";
import { getPraticaWorkContext } from "@/lib/praticaLock";
import { PraticaCollegatePanel } from "@/components/pratica/PraticaCollegatePanel";
import { PraticaSchedaOperatore } from "@/components/pratica/PraticaSchedaOperatore";
import { PraticaLockWatcher } from "@/components/pratica/PraticaLockWatcher";

export default async function PraticaDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    collegata?: string;
    elenco?: string;
    da?: string;
    q?: string;
    stato?: string;
    esito?: string;
    lavorate?: string;
    lavorateData?: string;
    lavorateOggi?: string;
    nonToccateDa?: string;
    sort?: string;
    dir?: string;
    page?: string;
  }>;
}) {
  const user = await requireUser();
  const recordingMode = await getRecordingMode();
  const { id } = await params;
  const sp = await searchParams;
  const {
    collegata: collegataRaw,
    elenco: elencoRaw,
    da: daRaw,
  } = sp;
  const filtroCollegata = parseFiltroCollegata(collegataRaw);
  const usaCodaNav = !filtroCollegata && hasCodaNavParams(sp);
  const codaNav: CodaNav | undefined = filtroCollegata ? undefined : parseCodaNav(sp);
  const showElenco = elencoRaw === "1" && Boolean(filtroCollegata);
  const origineId = filtroCollegata ? parsePraticaOrigine(daRaw) : undefined;
  if (!(await canAccessPratica(user, id))) notFound();

  const pratica = await prisma.pratica.findUnique({
    where: { id },
    include: {
      debitore: {
        include: {
          recapiti: { orderBy: [{ tipo: "asc" }, { ordine: "asc" }] },
        },
      },
      mandante: true,
      assegnatario: true,
      operatoreTitolare: true,
      attivita: { include: { user: true }, orderBy: { createdAt: "desc" } },
      incassi: { include: { user: true }, orderBy: { data: "desc" } },
      documenti: { orderBy: { createdAt: "desc" } },
      fatture: { orderBy: { dataScadenza: "asc" } },
      rate: { orderBy: { numeroRata: "asc" } },
      garanti: {
        orderBy: { ordine: "asc" },
        include: { recapiti: { orderBy: [{ tipo: "asc" }, { ordine: "asc" }] } },
      },
    },
  });
  if (!pratica) notFound();

  const { canWork, lockedByName } = await getPraticaWorkContext(user.id, id);

  let collegataIds: string[] | null = null;
  if (filtroCollegata) {
    collegataIds = await praticheStessoDebitoreIds(id, filtroCollegata);
    if (!collegataIds.length) notFound();
    if (!collegataIds.includes(id)) {
      redirect(
        buildPraticaCollegataHref(collegataIds[0], filtroCollegata, {
          elenco: elencoRaw === "1",
          da: origineId,
        })
      );
    }
  }

  const coda = filtroCollegata
    ? null
    : usaCodaNav && codaNav
      ? await (async () => {
          const whereCoda = {
            ...praticaWhere(user),
            ...(codaNav.filtro ? codaFiltroWhere(codaNav.filtro) : {}),
          };
          if (isUltimaLavorazioneSort(codaNav.sort)) {
            const ids = await orderPraticaIdsByUltimaLavorazione(
              whereCoda,
              codaNav.dir
            );
            return ids.map((id) => ({ id }));
          }
          return prisma.pratica.findMany({
            where: whereCoda,
            select: { id: true },
            orderBy: buildOrderBy(codaNav.sort, codaNav.dir),
          });
        })()
      : await prisma.pratica.findMany({
          where: {
            ...praticaWhere(user),
            ...(codaNav?.filtro ? codaFiltroWhere(codaNav.filtro) : {}),
          },
          select: { id: true },
          orderBy: { updatedAt: "desc" },
        });

  let nav: {
    page: number;
    totalPages: number;
    ids: string[];
    filtroCollegata?: "aperta" | "chiusa";
    codaNav?: CodaNav;
  };

  if (filtroCollegata && collegataIds) {
    const collegataIndex = collegataIds.indexOf(id);
    nav = {
      page: collegataIndex >= 0 ? collegataIndex + 1 : 1,
      totalPages: Math.max(1, collegataIds.length),
      ids: collegataIds,
      filtroCollegata,
    };
  } else {
    const codaIds = (coda || []).map((p) => p.id);
    const codaIndex = codaIds.indexOf(pratica.id);
    const ids =
      codaIndex >= 0
        ? codaIds
        : codaIds.length
          ? [pratica.id, ...codaIds]
          : [pratica.id];
    nav = {
      page: codaIndex >= 0 ? codaIndex + 1 : 1,
      totalPages: Math.max(1, ids.length),
      ids,
      codaNav: usaCodaNav ? codaNav : undefined,
    };
  }

  const originePratica = origineId
    ? await prisma.pratica.findUnique({
        where: { id: origineId },
        select: { numero: true },
      })
    : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden max-lg:overflow-visible lg:h-full">
      <PraticaLockWatcher praticaId={pratica.id} owned={canWork} />

      <div
        className={`flex min-h-0 flex-1 flex-col overflow-hidden max-lg:overflow-visible lg:flex-row ${showElenco ? "gap-2" : ""}`}
      >
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <PraticaSchedaOperatore
            pratica={pratica}
            canEditNotes={canWork}
            canEditStato={canWork && can(user, "pratiche:update:stato")}
            canRegistraIncasso={canWork && can(user, "incassi:create")}
            lockedByName={lockedByName}
            nav={nav}
            currentUserName={user.name}
            currentUserRole={user.role}
            prefissoChiamata={user.prefissoChiamata}
            recordingMode={recordingMode}
            elencoAperto={showElenco}
            origineId={origineId}
            origineNumero={originePratica?.numero}
          />
        </div>
        {showElenco && filtroCollegata ? (
          <PraticaCollegatePanel
            praticaId={pratica.id}
            filtro={filtroCollegata}
            origineId={origineId}
          />
        ) : null}
      </div>
    </div>
  );
}
