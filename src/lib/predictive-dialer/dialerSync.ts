import "server-only";
import { prisma } from "@/lib/prisma";import type { SessionUser } from "@/lib/permissions";
import { syncCampagnaConDialer } from "@/lib/predictive-dialer/campaigns";
import { getPredictiveDialerService } from "@/lib/predictive-dialer/service/factory";
import type { DialerOperatorRef } from "@/lib/predictive-dialer/service/PredictiveDialerService";
import { normalizePacingRatio } from "@/lib/predictive-dialer/pacing";

export function providerSupportsSetPacing(providerId: string): boolean {
  return providerId !== "null";
}

export async function countOperatoriDisponibili(campagnaId: string): Promise<number> {
  return prisma.dialerCampagnaOperatore.count({
    where: { campagnaId, sessioneStato: "disponibile", accettatoAt: { not: null }, uscitaAt: null },
  });
}

/** Comunica al dialer la disponibilità reale degli operatori e sincronizza la coda solo se necessario. */
export async function notifyDialerOperatorAvailability(
  user: SessionUser,
  campagnaId: string,
  operatore: DialerOperatorRef,
  available: boolean
) {
  const campagna = await prisma.dialerCampagna.findFirst({
    where: { id: campagnaId, tenantId: user.tenantId },
  });
  if (!campagna?.externalId || campagna.stato !== "ATTIVA") return;

  const service = await getPredictiveDialerService(user.tenantId);

  if (available) {
    await service.addOperator(campagna.externalId, operatore);
    await service.setOperatorAvailable(campagna.externalId, operatore, true);
  } else {
    await service.setOperatorAvailable(campagna.externalId, operatore, false);
  }

  const disponibili = await countOperatoriDisponibili(campagnaId);
  if (disponibili > 0) {
    await syncCampagnaConDialer(user, campagnaId);
    if (providerSupportsSetPacing(service.providerId) && service.setPacing && campagna.pacingRatio != null) {
      await service.setPacing(campagna.externalId, normalizePacingRatio(campagna.pacingRatio));
    }
  }
}

export async function notifyDialerOperatorPaused(
  user: SessionUser,
  campagnaId: string,
  operatore: DialerOperatorRef
) {
  const campagna = await prisma.dialerCampagna.findFirst({
    where: { id: campagnaId, tenantId: user.tenantId },
  });
  if (!campagna?.externalId) return;
  const service = await getPredictiveDialerService(user.tenantId);
  await service.setOperatorPaused(campagna.externalId, operatore);
  await service.setOperatorAvailable(campagna.externalId, operatore, false);
}

export async function notifyDialerAfterAvailabilityChange(user: SessionUser, campagnaId: string) {
  const disponibili = await countOperatoriDisponibili(campagnaId);
  if (disponibili > 0) {
    await syncCampagnaConDialer(user, campagnaId);
  }
}
