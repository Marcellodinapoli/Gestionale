import "server-only";
import { prisma } from "@/lib/prisma";
import { mapDialerCampagna } from "@/lib/predictive-dialer/mappers";
import type { SessionUser } from "@/lib/permissions";
import type {
  DialerInvitoCampagnaDto,
  DialerOperatoreSessioneDto,
} from "@/lib/predictive-dialer/types";
import { completePostCallIfExpired } from "@/lib/predictive-dialer/callEvents";
import {
  notifyDialerAfterAvailabilityChange,
  notifyDialerOperatorAvailability,
  notifyDialerOperatorPaused,
} from "@/lib/predictive-dialer/dialerSync";

export async function loadInvitiOperatore(user: SessionUser): Promise<DialerInvitoCampagnaDto[]> {
  const rows = await prisma.dialerCampagnaOperatore.findMany({
    where: {
      operatoreId: user.id,
      campagna: { tenantId: user.tenantId, stato: { in: ["ATTIVA", "PAUSA"] } },
      uscitaAt: null,
    },
    include: { campagna: true },
    orderBy: { invitatoAt: "desc" },
  });
  return rows.map((r) => ({
    campagna: mapDialerCampagna(r.campagna),
    invitatoAt: r.invitatoAt.toISOString(),
    accettatoAt: r.accettatoAt?.toISOString() ?? null,
  }));
}

export async function loadSessioneOperatore(
  user: SessionUser,
  campagnaId?: string
): Promise<DialerOperatoreSessioneDto | null> {
  const where = {
    operatoreId: user.id,
    accettatoAt: { not: null },
    uscitaAt: null,
    ...(campagnaId ? { campagnaId } : {}),
    campagna: { tenantId: user.tenantId, stato: { in: ["ATTIVA", "PAUSA"] as string[] } },
  };
  const row = await prisma.dialerCampagnaOperatore.findFirst({
    where,
    include: { campagna: true },
    orderBy: { accettatoAt: "desc" },
  });
  if (!row) return null;

  if (row.sessioneStato === "post_call") {
    await completePostCallIfExpired(user, row.campagnaId, user.id);
    const refreshed = await prisma.dialerCampagnaOperatore.findUnique({ where: { id: row.id } });
    if (refreshed) Object.assign(row, refreshed);
  }

  return {
    campagnaId: row.campagnaId,
    campagnaNome: row.campagna.nome,
    operatoreId: row.operatoreId,
    sessioneStato: row.sessioneStato as DialerOperatoreSessioneDto["sessioneStato"],
    accettatoAt: row.accettatoAt?.toISOString() ?? null,
    pausaInizioAt: row.pausaInizioAt?.toISOString() ?? null,
    postCallFineAt: row.postCallFineAt?.toISOString() ?? null,
    postCallSec: row.campagna.postCallSec,
    praticaCorrenteId: row.praticaCorrenteId,
    chiamateCount: row.chiamateCount,
    durataTotaleSec: row.durataTotaleSec,
  };
}

export async function acceptCampagnaSession(user: SessionUser, campagnaId: string) {
  const row = await prisma.dialerCampagnaOperatore.findFirst({
    where: { campagnaId, operatoreId: user.id },
    include: { campagna: true, operatore: { select: { interno: true } } },
  });
  if (!row) throw new Error("Non sei invitato a questa campagna");
  if (row.campagna.stato !== "ATTIVA" && row.campagna.stato !== "PAUSA") {
    throw new Error("Campagna non attiva");
  }

  await prisma.dialerCampagnaOperatore.update({
    where: { id: row.id },
    data: {
      accettatoAt: new Date(),
      sessioneStato: "disponibile",
      uscitaAt: null,
      lastHeartbeatAt: new Date(),
    },
  });

  await notifyDialerOperatorAvailability(
    user,
    campagnaId,
    { operatoreId: user.id, interno: row.operatore.interno },
    true
  );
}

export async function pauseDialerSession(user: SessionUser, campagnaId: string) {
  await prisma.dialerCampagnaOperatore.updateMany({
    where: { campagnaId, operatoreId: user.id, accettatoAt: { not: null } },
    data: { sessioneStato: "pausa", pausaInizioAt: new Date() },
  });
  await notifyDialerOperatorPaused(user, campagnaId, { operatoreId: user.id });
}

export async function resumeDialerSession(user: SessionUser, campagnaId: string) {
  const op = await prisma.dialerCampagnaOperatore.findFirst({
    where: { campagnaId, operatoreId: user.id },
    include: { operatore: { select: { interno: true } } },
  });
  if (!op) throw new Error("Sessione non trovata");
  await prisma.dialerCampagnaOperatore.update({
    where: { id: op.id },
    data: { sessioneStato: "disponibile", pausaInizioAt: null },
  });
  await notifyDialerOperatorAvailability(
    user,
    campagnaId,
    { operatoreId: user.id, interno: op.operatore.interno },
    true
  );
}

export async function exitDialerSession(user: SessionUser, campagnaId: string) {
  const op = await prisma.dialerCampagnaOperatore.findFirst({
    where: { campagnaId, operatoreId: user.id },
    include: { campagna: true, operatore: { select: { interno: true } } },
  });
  if (!op) return;
  await prisma.dialerCampagnaOperatore.update({
    where: { id: op.id },
    data: {
      sessioneStato: "fuori",
      uscitaAt: new Date(),
      praticaCorrenteId: null,
      postCallFineAt: null,
      pausaInizioAt: null,
    },
  });
  await notifyDialerOperatorAvailability(
    user,
    campagnaId,
    { operatoreId: user.id, interno: op.operatore.interno },
    false
  );
}

export async function finishPostCallManual(user: SessionUser, campagnaId: string) {
  await prisma.dialerCampagnaOperatore.updateMany({
    where: { campagnaId, operatoreId: user.id, sessioneStato: "post_call" },
    data: { sessioneStato: "disponibile", postCallFineAt: null, praticaCorrenteId: null },
  });
  const op = await prisma.user.findUnique({
    where: { id: user.id },
    select: { interno: true },
  });
  await notifyDialerOperatorAvailability(
    user,
    campagnaId,
    { operatoreId: user.id, interno: op?.interno },
    true
  );
  await notifyDialerAfterAvailabilityChange(user, campagnaId);
}
