import type { SessionUser } from "@/lib/permissions";
import { can } from "@/lib/permissions";
import {
  filtraIdsPraticaScope,
  praticaScopeWhere,
  resolveGruppoPerimetroContext,
} from "@/lib/gruppoPerimetroScope";
import {
  altriFiltriWhere,
  hasAltriFiltri,
  idsAffidoTemporaneo,
  idsImportoTotale,
  idsTotIncassato,
  parseAltriFiltri,
} from "@/lib/praticheAltriFiltri";
import { STATI_PRATICA_CHIUSA } from "@/lib/praticheInattive";
import { buildOrderBy } from "@/lib/praticaOrdine";
import { codaFiltroWhere, parseCodaNav } from "@/lib/praticaCoda";
import { PRATICHE_PAGE_SIZE } from "@/components/PaginazioneBar";
import { prisma } from "../lib/instrumentedPrisma";
import { globalMetrics } from "../lib/metrics";

const DEFAULT_SP: Record<string, string> = { stato: "IN_LAVORAZIONE" };

export async function measurePraticheList(
  user: SessionUser,
  sp: Record<string, string> = DEFAULT_SP,
  opts?: { withAltriFiltriImporto?: boolean }
) {
  const t0 = performance.now();
  const codaNav = parseCodaNav(sp);
  const altri = parseAltriFiltri(sp);
  const pageSize = PRATICHE_PAGE_SIZE;
  const page = 1;

  globalMetrics.startBlock("pratiche_scope");
  const periCtx = await resolveGruppoPerimetroContext(user);
  const baseScope = await praticaScopeWhere(user);
  globalMetrics.endBlock();

  const canFilterOp = ["ADMIN", "BACK_OFFICE", "AMMINISTRAZIONE", "SUPERVISOR"].includes(
    user.role
  );
  const needTemporanea =
    altri?.sitAffido === "temporanea" || altri?.affidoProvvisorio === "1";
  const needImportoTot =
    opts?.withAltriFiltriImporto || Boolean(altri?.importoTotDa || altri?.importoTotA);
  const needTotInc =
    opts?.withAltriFiltriImporto || Boolean(altri?.totIncassatoDa || altri?.totIncassatoA);

  globalMetrics.startBlock("pratiche_prefetch");
  const praticaCtx = {
    tenantId: user.tenantId,
    tenantSlug: user.tenantSlug ?? user.tenantId,
    role: user.role,
    userId: user.id,
  };
  const [temporaneaIdsRaw, importoTotIdsRaw, totIncassatoIdsRaw, lottiRows] =
    await Promise.all([
      needTemporanea ? idsAffidoTemporaneo(praticaCtx) : Promise.resolve([] as string[]),
      needImportoTot
        ? idsImportoTotale(praticaCtx, altri?.importoTotDa, altri?.importoTotA)
        : Promise.resolve(null as string[] | null),
      needTotInc
        ? idsTotIncassato(praticaCtx, altri?.totIncassatoDa, altri?.totIncassatoA)
        : Promise.resolve(null as string[] | null),
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
    ]);
  globalMetrics.endBlock();

  globalMetrics.startBlock("pratiche_altri_filtri_scope");
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
  globalMetrics.endBlock();

  const altriWhere =
    altri && hasAltriFiltri(altri)
      ? altriFiltriWhere(canFilterOp ? altri : { ...altri, operatore: undefined }, {
          canFilterOperatore: canFilterOp,
          temporaneaIds: temporaneaIds ?? undefined,
          importoTotIds,
          totIncassatoIds,
        })
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

  globalMetrics.startBlock("pratiche_count");
  const total = await prisma.pratica.count({ where });
  globalMetrics.endBlock();

  globalMetrics.startBlock("pratiche_findMany_page");
  const pratiche = await prisma.pratica.findMany({
    where,
    include,
    orderBy: buildOrderBy(codaNav.sort, codaNav.dir),
    skip: 0,
    take: pageSize,
  });
  globalMetrics.endBlock();

  return {
    totalDurationMs: Math.round(performance.now() - t0),
    total,
    pageSize,
    page,
    rowsReturned: pratiche.length,
    lottiDistinct: lottiRows.length,
    hadImportoFiltri: needImportoTot || needTotInc,
    canNotaMassiva: can(user, "pratiche:nota-massiva"),
    periCtxNelGruppo: periCtx.nelGruppo,
  };
}
