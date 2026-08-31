import type { SessionUser } from "@/lib/permissions";
import { can, isManutenzione } from "@/lib/permissions";
import { nessunDatoWhere } from "@/lib/domain";
import {
  formatDataIso,
  lavoratePerOperatoreInGiornata,
  praticheLavorateInGiornata,
  praticheConCambioCodiceInGiornata,
  parseDataIso,
  startOfToday,
  completaOperatoriGruppo,
  applicaCambiCodicePerOperatore,
} from "@/lib/lavorateOggi";
import {
  praticaScopeWhere,
  resolveGruppoPerimetroContext,
  gruppoPerimetroOptsFromContext,
} from "@/lib/gruppoPerimetroScope";
import { getGruppoLavoro } from "@/lib/gruppoLavoro";
import {
  codiciPerMandantePerimetro,
  daAffidarePerPerimetroGruppo,
  inLavorazionePerPerimetro,
} from "@/lib/codiciMandantePerimetro";
import { prisma } from "../lib/instrumentedPrisma";
import { globalMetrics } from "../lib/metrics";

/** Replica il batch condiviso home (tutti i ruoli) + layout overhead. */
export async function measureHomeSharedBatch(user: SessionUser) {
  globalMetrics.startBlock("layout_getCurrentUser");
  // Simula include utente già in loadSessionUser — 1 findFirst equivalente
  await prisma.user.findFirst({
    where: { id: user.id, tenantId: user.tenantId },
    include: {
      tenant: { select: { id: true, slug: true, nome: true, active: true } },
      postazione: { select: { interno: true, email: true, nome: true } },
      sede: { select: { id: true, nome: true } },
    },
  });
  globalMetrics.endBlock();

  globalMetrics.startBlock("layout_needsSediSetup");
  await prisma.sede.count({ where: { tenantId: user.tenantId, active: true } });
  globalMetrics.endBlock();

  globalMetrics.startBlock("layout_dialConfig");
  await prisma.configurazioneSistema.findMany({
    where: { tenantId: user.tenantId },
  });
  globalMetrics.endBlock();

  globalMetrics.startBlock("home_setup_gruppo");
  const gruppo = await getGruppoLavoro(user);
  const periCtx = await resolveGruppoPerimetroContext(user);
  const where = await praticaScopeWhere(user);
  globalMetrics.endBlock();

  const dataLavorate = startOfToday();
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
  const vistaGruppoLavorate =
    user.role === "SUPERVISOR" || user.role === "BACK_OFFICE";
  const lavorateOpts = { data: dataLavorate, scopeWhere: where };

  globalMetrics.startBlock("home_shared_batch");
  const [
    totali,
    inLavoroPerPerimetro,
    scadute,
    incassiOggi,
    lavoratePerOperatoreRaw,
    praticheLavorateGruppo,
    praticheCambioCodice,
    codiciMandantePerimetro,
    daAffidareGruppo,
  ] = await Promise.all([
    prisma.pratica.count({ where }),
    inLavorazionePerPerimetro(user, gruppoPerimetroOpts),
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
    lavoratePerOperatoreInGiornata(user, lavorateOpts),
    vistaGruppoLavorate
      ? praticheLavorateInGiornata(user, lavorateOpts)
      : Promise.resolve([]),
    praticheConCambioCodiceInGiornata(user, lavorateOpts),
    isManutenzione(user)
      ? Promise.resolve([])
      : codiciPerMandantePerimetro(user, gruppoPerimetroOpts),
    mostraGruppo && !isManutenzione(user)
      ? daAffidarePerPerimetroGruppo(user.tenantId, gruppo.gruppoMandanti)
      : Promise.resolve([]),
  ]);
  globalMetrics.endBlock();

  globalMetrics.startBlock("home_post_process");
  applicaCambiCodicePerOperatore(
    vistaGruppoLavorate
      ? completaOperatoriGruppo(lavoratePerOperatoreRaw, gruppo.members)
      : lavoratePerOperatoreRaw,
    praticheCambioCodice
  );
  globalMetrics.endBlock();

  return {
    totali,
    inLavoroPerPerimetro: inLavoroPerPerimetro.length,
    scadute,
    incassiOggi: incassiOggi._sum.importo,
    lavorateGruppo: praticheLavorateGruppo.length,
    codiciRows: codiciMandantePerimetro.length,
    daAffidareRows: daAffidareGruppo.length,
  };
}

/** Replica branch ADMIN (peggior caso). */
export async function measureHomeAdminBranch(user: SessionUser) {
  const oggi = new Date();
  oggi.setHours(0, 0, 0, 0);
  const inizioMese = new Date(oggi.getFullYear(), oggi.getMonth(), 1);

  globalMetrics.startBlock("admin_riepilogo_mandanti");
  const mandanti = await prisma.mandante.findMany({
    where: { tenantId: user.tenantId },
    select: { id: true, codice: true, ragioneSociale: true },
  });
  await prisma.pratica.findMany({
    where: { tenantId: user.tenantId },
    select: {
      mandanteId: true,
      capitale: true,
      interessi: true,
      spese: true,
      incassi: { select: { importo: true } },
    },
  });
  globalMetrics.endBlock();

  globalMetrics.startBlock("admin_groupby_lotti");
  await prisma.pratica.groupBy({
    by: ["mandanteId", "numeroMandante"],
    where: { tenantId: user.tenantId, numeroMandante: { not: null } },
  });
  globalMetrics.endBlock();

  globalMetrics.startBlock("admin_incassi_groupby");
  await Promise.all([
    prisma.incasso.groupBy({
      by: ["metodo"],
      where: { pratica: { tenantId: user.tenantId } },
      _sum: { importo: true },
      _count: true,
    }),
    prisma.incasso.groupBy({
      by: ["metodo"],
      where: { pratica: { tenantId: user.tenantId }, data: { gte: inizioMese } },
      _sum: { importo: true },
      _count: true,
    }),
  ]);
  globalMetrics.endBlock();

  globalMetrics.startBlock("admin_produttivita");
  const inizioOggi = new Date(oggi);
  const fineOggi = new Date(oggi);
  fineOggi.setHours(23, 59, 59, 999);
  await prisma.attivita.groupBy({
    by: ["userId"],
    where: { createdAt: { gte: inizioOggi, lte: fineOggi } },
    _count: true,
  });
  await prisma.user.findMany({
    where: {
      tenantId: user.tenantId,
      role: { in: ["OPERATOR", "SUPERVISOR"] },
      active: true,
    },
    select: { id: true, name: true },
  });
  globalMetrics.endBlock();

  globalMetrics.startBlock("admin_carico_gruppi");
  const supervisori = await prisma.user.findMany({
    where: { tenantId: user.tenantId, role: "SUPERVISOR", active: true },
    select: { id: true, name: true, gruppoNome: true },
  });
  for (const s of supervisori) {
    const memberIds = [
      s.id,
      ...(
        await prisma.user.findMany({
          where: { tenantId: user.tenantId, supervisorId: s.id, active: true },
          select: { id: true },
        })
      ).map((u) => u.id),
    ];
    await Promise.all([
      prisma.pratica.count({
        where: {
          assegnatarioId: { in: memberIds },
          stato: { notIn: ["INCASSO", "RESA", "INESIGIBILE"] },
        },
      }),
      prisma.pratica.count({ where: { assegnatarioId: { in: memberIds } } }),
    ]);
  }
  globalMetrics.endBlock();

  globalMetrics.startBlock("admin_allerte_esiti");
  await Promise.all([
    prisma.pratica.groupBy({
      by: ["esitoContatto"],
      where: { tenantId: user.tenantId, esitoContatto: { not: null } },
      _count: true,
    }),
    prisma.pratica.count({
      where: {
        tenantId: user.tenantId,
        scadenza: { lt: oggi },
        stato: { notIn: ["INCASSO", "RESA", "INESIGIBILE"] },
      },
    }),
    prisma.pratica.count({
      where: {
        tenantId: user.tenantId,
        scadenza: { gte: oggi, lte: new Date(oggi.getTime() + 7 * 86400000) },
        stato: { notIn: ["INCASSO", "RESA", "INESIGIBILE"] },
      },
    }),
    prisma.pratica.count({
      where: {
        tenantId: user.tenantId,
        assegnatarioId: null,
        stato: { notIn: ["INCASSO", "RESA", "INESIGIBILE"] },
      },
    }),
  ]);
  globalMetrics.endBlock();

  return { mandanti: mandanti.length, supervisori: supervisori.length };
}

export async function measureHome(user: SessionUser) {
  const t0 = performance.now();
  await measureHomeSharedBatch(user);
  if (user.role === "ADMIN") {
    await measureHomeAdminBranch(user);
  }
  return { totalDurationMs: Math.round(performance.now() - t0) };
}
