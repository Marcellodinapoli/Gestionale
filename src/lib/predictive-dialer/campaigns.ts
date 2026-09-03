import "server-only";
import { prisma } from "@/lib/prisma";
import { praticaDbFromUser } from "@/lib/praticheRepo";
import { usersDbFromUser } from "@/lib/usersRepo";
import type { SessionUser } from "@/lib/permissions";
import { getPredictiveDialerService } from "@/lib/predictive-dialer/service/factory";
import { mapDialerCampagna } from "@/lib/predictive-dialer/mappers";
import {
  dialerCampagnaScopeWhere,
  parseCodiciScaricoJson,
  serializeCodiciScarico,
} from "@/lib/predictive-dialer/scope";
import type { DialerQueueEntry } from "@/lib/predictive-dialer/service/PredictiveDialerService";

export async function buildDialerQueue(campagnaId: string): Promise<DialerQueueEntry[]> {
  const now = new Date();
  const items = await prisma.dialerCampagnaPratica.findMany({
    where: {
      campagnaId,
      stato: { in: ["disponibile", "richiamare", "non_risposta"] },
      lockedByOperatoreId: null,
      OR: [{ prossimoTentativoAt: null }, { prossimoTentativoAt: { lte: now } }],
    },
    include: {
      pratica: {
        select: {
          id: true,
          codiceScarico: true,
          debitore: { select: { telefono: true, telefonoStato: true } },
        },
      },
    },
  });
  return items
    .map((item) => ({
      praticaId: item.praticaId,
      numero: item.pratica.debitore?.telefono?.trim() ?? "",
      codiceScarico: item.pratica.codiceScarico,
    }))
    .filter((e) => e.numero.length > 0);
}

export async function syncCampagnaConDialer(user: SessionUser, campagnaId: string) {
  const campagna = await prisma.dialerCampagna.findFirst({
    where: { id: campagnaId, tenantId: user.tenantId },
  });
  if (!campagna?.externalId) return;
  const service = await getPredictiveDialerService(user.tenantId);
  const queue = await buildDialerQueue(campagnaId);
  await service.syncQueue(campagna.externalId, queue);
}

export async function attachPraticheToCampagna(
  user: SessionUser,
  campagnaId: string,
  opts: { praticaIds?: string[]; codiciScarico?: string[] }
) {
  const campagna = await prisma.dialerCampagna.findFirst({
    where: { id: campagnaId, tenantId: user.tenantId },
  });
  if (!campagna) throw new Error("Campagna non trovata");

  const codici = opts.codiciScarico?.length
    ? opts.codiciScarico
    : parseCodiciScaricoJson(campagna.codiciScarico);

  let praticaIds = opts.praticaIds ?? [];
  if (!praticaIds.length && codici.length) {
    const pratiche = await praticaDbFromUser(user).findMany({
      where: {
        tenantId: user.tenantId,
        codiceScarico: { in: codici },
        stato: { notIn: ["INCASSO", "RESA", "INESIGIBILE"] },
      },
      select: { id: true },
    });
    praticaIds = pratiche.map((p) => p.id);
  }

  if (!praticaIds.length) return 0;

  const existing = await prisma.dialerCampagnaPratica.findMany({
    where: { campagnaId, praticaId: { in: praticaIds } },
    select: { praticaId: true },
  });
  const existingSet = new Set(existing.map((e) => e.praticaId));
  const toCreate = praticaIds.filter((id) => !existingSet.has(id));
  if (!toCreate.length) return 0;

  await prisma.dialerCampagnaPratica.createMany({
    data: toCreate.map((praticaId) => ({ campagnaId, praticaId })),
  });
  return toCreate.length;
}

const STATI_CODA_REINTEGRO = ["non_risposta", "conclusa", "richiamare"] as const;

/** Rimettere in coda pratiche per codice scarico (es. non risposte) e/o aggiungere nuove dal gestionale. */
export async function reintegrateCodiciScaricoInCampagna(
  user: SessionUser,
  campagnaId: string,
  input: {
    codiciScarico: string[];
    statiCoda?: string[];
    includiNuove?: boolean;
  }
) {
  const campagna = await prisma.dialerCampagna.findFirst({
    where: { id: campagnaId, tenantId: user.tenantId },
  });
  if (!campagna) throw new Error("Campagna non trovata");
  if (campagna.stato !== "ATTIVA" && campagna.stato !== "PAUSA") {
    throw new Error("La campagna deve essere attiva o in pausa");
  }

  const codici = input.codiciScarico.map((c) => c.trim().toUpperCase()).filter(Boolean);
  if (!codici.length) throw new Error("Seleziona almeno un codice scarico");

  const stati = (input.statiCoda?.length ? input.statiCoda : [...STATI_CODA_REINTEGRO]).filter(Boolean);

  const items = await prisma.dialerCampagnaPratica.findMany({
    where: {
      campagnaId,
      stato: { in: stati },
      lockedByOperatoreId: null,
    },
    include: { pratica: { select: { codiceScarico: true } } },
  });

  const idsToReset = items
    .filter((i) => codici.includes(i.pratica.codiceScarico?.trim().toUpperCase() ?? ""))
    .map((i) => i.id);

  let reset = 0;
  if (idsToReset.length) {
    const result = await prisma.dialerCampagnaPratica.updateMany({
      where: { id: { in: idsToReset } },
      data: {
        stato: "disponibile",
        lockedByCallId: null,
        lockedAt: null,
        lockedByOperatoreId: null,
        prossimoTentativoAt: null,
      },
    });
    reset = result.count;
  }

  let added = 0;
  if (input.includiNuove !== false) {
    added = await attachPraticheToCampagna(user, campagnaId, { codiciScarico: codici });
  }

  if (campagna.stato === "ATTIVA") {
    await syncCampagnaConDialer(user, campagnaId);
  }

  return { reset, added, totale: reset + added };
}

export async function attachOperatoriToCampagna(
  user: SessionUser,
  campagnaId: string,
  operatoreIds: string[]
) {
  if (!operatoreIds.length) return 0;
  const valid = await usersDbFromUser(user).findMany({
    where: {
      tenantId: user.tenantId,
      id: { in: operatoreIds },
      active: true,
      role: { in: ["OPERATOR", "SUPERVISOR"] },
    },
    select: { id: true },
  });
  const ids = valid.map((o) => o.id);
  const existing = await prisma.dialerCampagnaOperatore.findMany({
    where: { campagnaId, operatoreId: { in: ids } },
    select: { operatoreId: true },
  });
  const existingSet = new Set(existing.map((e) => e.operatoreId));
  const toCreate = ids.filter((id) => !existingSet.has(id));
  if (!toCreate.length) return 0;
  await prisma.dialerCampagnaOperatore.createMany({
    data: toCreate.map((operatoreId) => ({ campagnaId, operatoreId })),
  });
  return toCreate.length;
}

export async function listCampagneForUser(user: SessionUser) {
  const rows = await prisma.dialerCampagna.findMany({
    where: dialerCampagnaScopeWhere(user),
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { operatori: true, pratiche: true, eventi: true } },
    },
  });
  return rows.map((r) => ({
    ...mapDialerCampagna(r),
    operatoriCount: r._count.operatori,
    praticheCount: r._count.pratiche,
    eventiCount: r._count.eventi,
  }));
}

export async function createCampagnaRecord(
  user: SessionUser,
  input: {
    nome: string;
    descrizione?: string;
    codiciScarico?: string[];
    postCallSec?: number;
    pacingRatio?: number | null;
    operatoreIds?: string[];
    praticaIds?: string[];
  }
) {
  const campagna = await prisma.dialerCampagna.create({
    data: {
      tenantId: user.tenantId,
      nome: input.nome.trim(),
      descrizione: input.descrizione?.trim() ?? "",
      codiciScarico: serializeCodiciScarico(input.codiciScarico ?? []),
      postCallSec: input.postCallSec ?? 60,
      pacingRatio: input.pacingRatio != null ? input.pacingRatio : null,
      createdById: user.id,
      supervisorId: user.role === "SUPERVISOR" ? user.id : null,
    },
  });
  await attachOperatoriToCampagna(user, campagna.id, input.operatoreIds ?? []);
  await attachPraticheToCampagna(user, campagna.id, {
    praticaIds: input.praticaIds,
    codiciScarico: input.codiciScarico,
  });
  return mapDialerCampagna(campagna);
}

export async function activateCampagnaRecord(user: SessionUser, campagnaId: string) {
  const campagna = await prisma.dialerCampagna.findFirst({
    where: { id: campagnaId, tenantId: user.tenantId },
  });
  if (!campagna) throw new Error("Campagna non trovata");
  const dto = mapDialerCampagna(campagna);
  const service = await getPredictiveDialerService(user.tenantId);
  const { externalId } = await service.startCampaign(dto, []);
  await prisma.dialerCampagna.update({
    where: { id: campagnaId },
    data: { stato: "ATTIVA", externalId, activatedAt: new Date() },
  });
  return externalId;
}

export async function deactivateCampagnaRecord(user: SessionUser, campagnaId: string) {
  const campagna = await prisma.dialerCampagna.findFirst({
    where: { id: campagnaId, tenantId: user.tenantId },
  });
  if (!campagna) throw new Error("Campagna non trovata");
  if (campagna.externalId) {
    const service = await getPredictiveDialerService(user.tenantId);
    await service.stopCampaign(campagna.externalId);
  }
  await prisma.dialerCampagna.update({
    where: { id: campagnaId },
    data: { stato: "TERMINATA" },
  });
  await prisma.dialerCampagnaOperatore.updateMany({
    where: { campagnaId, sessioneStato: { not: "fuori" } },
    data: { sessioneStato: "offline", praticaCorrenteId: null, postCallFineAt: null },
  });
}
