import { notFound, redirect } from "next/navigation";
import { incassiDbFromUser } from "@/lib/incassiRepo";
import { prisma } from "@/lib/prisma";
import { praticaDbFromUser, idsAffidoTemporaneoForTenant, idsImportoTotaleForTenant, idsTotIncassatoForTenant, type PraticaDbContext } from "@/lib/praticheRepo";
import { requireUser } from "@/lib/guard";
import { can } from "@/lib/permissions";
import { canAccessPratica } from "@/lib/domain";
import {
  collegataIdsFromPayload,
  loadPraticheStessoDebitorePayload,
} from "@/lib/praticheStessoDebitore";
import {
  buildPraticaCollegataHref,
  parseFiltroCollegata,
  parsePraticaOrigine,
} from "@/lib/praticaCollegata";
import {
  parseCodaNav,
  parseCodaPageIds,
  hasCodaNavParams,
  type CodaNav,
} from "@/lib/praticaCoda";
import { getRecordingMode } from "@/lib/recordingConfig";
import { getPraticaWorkContext } from "@/lib/praticaLock";
import {
  codiciScaricoOperatoriEffettivi,
  codiciScaricoOperatoriPerPratica,
  smsPreimpostatiPerPratica,
} from "@/lib/mandantePerimetri";
import { smsPreimpostatiEffettivi } from "@/lib/smsPreimpostati";
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
    ids?: string;
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
  const praticaModel = praticaDbFromUser(user);
  const { id } = await params;
  const sp = await searchParams;
  const {
    collegata: collegataRaw,
    elenco: elencoRaw,
    da: daRaw,
    ids: idsRaw,
  } = sp;
  const filtroCollegata = parseFiltroCollegata(collegataRaw);
  const usaCodaNav = !filtroCollegata && hasCodaNavParams(sp);
  const codaNav: CodaNav | undefined = filtroCollegata
    ? undefined
    : parseCodaNav(sp);
  const showElenco = elencoRaw === "1" && Boolean(filtroCollegata);
  const origineId = filtroCollegata ? parsePraticaOrigine(daRaw) : undefined;
  const pageIdsFromUrl = filtroCollegata ? null : parseCodaPageIds(idsRaw);

  const [recordingMode, accessOk, collegataPayload] = await Promise.all([
    getRecordingMode(user.tenantId),
    canAccessPratica(user, id),
    filtroCollegata
      ? loadPraticheStessoDebitorePayload(user.tenantId, id, user.tenantSlug ?? user.tenantId)
      : Promise.resolve(null),
  ]);
  if (!accessOk) notFound();

  let collegataIds: string[] | null = null;
  if (filtroCollegata) {
    if (!collegataPayload) notFound();
    collegataIds = collegataIdsFromPayload(collegataPayload, filtroCollegata);
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

  // Include leggero: anagrafica + rate. Note/incassi dettaglio via /extra.
  // Solo somma importi per il campo «Pagato» in scheda.
  const [pratica, workCtx, originePratica, incassiSum] = await Promise.all([
    praticaModel.findUnique({
      where: { id },
      include: {
        debitore: {
          include: {
            recapiti: { orderBy: [{ tipo: "asc" }, { ordine: "asc" }] },
          },
        },
        mandante: { select: { codice: true, ragioneSociale: true, perimetri: true, smsPreimpostati: true } },
        assegnatario: { select: { name: true } },
        rate: { orderBy: { numeroRata: "asc" } },
        garanti: {
          orderBy: { ordine: "asc" },
          include: {
            recapiti: { orderBy: [{ tipo: "asc" }, { ordine: "asc" }] },
          },
        },
      },
    }),
    getPraticaWorkContext(user, id),
    origineId
      ? praticaModel.findUnique({
          where: { id: origineId },
          select: { numero: true },
        })
      : Promise.resolve(null),
    incassiDbFromUser(user).aggregate({
      where: { praticaId: id },
      _sum: { importo: true },
    }),
  ]);
  if (!pratica) notFound();

  const pagato = Math.max(0, incassiSum._sum.importo || 0);
  const codiciScaricoOperatore = codiciScaricoOperatoriEffettivi(
    codiciScaricoOperatoriPerPratica(
      pratica.mandante.perimetri,
      pratica.numeroMandante
    )
  );
  const smsPresets = smsPreimpostatiEffettivi(
    smsPreimpostatiPerPratica(
      pratica.mandante.perimetri,
      pratica.numeroMandante,
      pratica.mandante.smsPreimpostati
    )
  );

  const { canWork, lockedByName } = workCtx;

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
  } else if (pageIdsFromUrl?.length) {
    const ids = pageIdsFromUrl.includes(id)
      ? pageIdsFromUrl
      : [id, ...pageIdsFromUrl.filter((x) => x !== id)];
    const idx = ids.indexOf(id);
    nav = {
      page: idx >= 0 ? idx + 1 : 1,
      totalPages: Math.max(1, ids.length),
      ids,
      codaNav: usaCodaNav ? codaNav : undefined,
    };
  } else {
    nav = {
      page: 1,
      totalPages: 1,
      ids: [id],
      codaNav: usaCodaNav ? codaNav : undefined,
    };
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden max-lg:overflow-visible lg:h-full">
      <PraticaLockWatcher praticaId={pratica.id} owned={canWork} />

      <div
        className={`flex min-h-0 flex-1 flex-col overflow-hidden max-lg:overflow-visible lg:flex-row ${showElenco ? "gap-2" : ""}`}
      >
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <PraticaSchedaOperatore
            pratica={{ ...pratica, pagato }}
            codiciScaricoOperatore={codiciScaricoOperatore}
            smsPresets={smsPresets}
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
            collegatePayload={collegataPayload}
          />
        </div>
        {showElenco && filtroCollegata ? (
          <PraticaCollegatePanel
            praticaId={pratica.id}
            filtro={filtroCollegata}
            origineId={origineId}
            initialData={collegataPayload}
          />
        ) : null}
      </div>
    </div>
  );
}
