import { randomUUID } from "crypto";import "server-only";
import { prisma } from "@/lib/prisma";
import { praticaDbFromUser } from "@/lib/praticheRepo";
import type { SessionUser } from "@/lib/permissions";
import type { DialerCallEventInput } from "@/lib/predictive-dialer/types";
import type { DialerEventoTipo } from "@/lib/predictive-dialer/constants";
import {
  buildCallProgress,
  buildDedupKey,
  evaluateEventSkipReason,
  resolveCallId,
  wasCallConnected,
} from "@/lib/predictive-dialer/eventDedup";
import {
  completePraticaInCoda,
  lockPraticaInCoda,
  releasePraticaInCoda,
} from "@/lib/predictive-dialer/queueLock";
import {
  notifyDialerAfterAvailabilityChange,
  notifyDialerOperatorAvailability,
} from "@/lib/predictive-dialer/dialerSync";

export type RegisterDialerEventResult = {
  ok: boolean;
  duplicate?: boolean;
  skipped?: boolean;
  skipReason?: string | null;
  callId?: string;
};

async function affidaPraticaSeCollegata(
  user: SessionUser,
  praticaId: string,
  operatoreId: string
): Promise<boolean> {
  const praticaModel = praticaDbFromUser(user);
  const pratica = await praticaModel.findUnique({
    where: { id: praticaId },
    select: { assegnatarioId: true, operatoreTitolareId: true, stato: true },
  });
  if (!pratica) return false;
  if (pratica.assegnatarioId) return false;

  await praticaModel.update({
    where: { id: praticaId },
    data: {
      assegnatarioId: operatoreId,
      operatoreTitolareId: operatoreId,
      stato: pratica.stato === "NUOVA" ? "IN_LAVORAZIONE" : pratica.stato,
      dataAffido: new Date(),
    },
  });
  return true;
}

async function loadCallProgress(campagnaId: string, callId: string) {
  const rows = await prisma.dialerChiamataEvento.findMany({
    where: { campagnaId, callId, applied: true },
    select: { tipo: true },
  });
  return buildCallProgress(rows.map((r) => r.tipo as DialerEventoTipo));
}

async function getOperatoreSession(campagnaId: string, operatoreId: string) {
  return prisma.dialerCampagnaOperatore.findFirst({
    where: { campagnaId, operatoreId, accettatoAt: { not: null }, uscitaAt: null },
  });
}

async function notifyOperatorAvailableAfterEvent(
  user: SessionUser,
  campagnaId: string,
  operatoreId: string
) {
  const op = await prisma.user.findUnique({
    where: { id: operatoreId },
    select: { interno: true },
  });
  await notifyDialerOperatorAvailability(
    user,
    campagnaId,
    { operatoreId, interno: op?.interno },
    true
  );
  await notifyDialerAfterAvailabilityChange(user, campagnaId);
}

export async function registerDialerCallEvent(
  user: SessionUser,
  input: DialerCallEventInput
): Promise<RegisterDialerEventResult> {
  const campagna = await prisma.dialerCampagna.findFirst({
    where: { id: input.campagnaId, tenantId: user.tenantId },
  });
  if (!campagna) throw new Error("Campagna non trovata");

  let callId = resolveCallId(input);
  if (!callId && input.tipo === "iniziata") {
    callId = `gen:${randomUUID()}`;
  }
  if (!callId) {
    return { ok: false, skipReason: "callId_mancante" };
  }

  const dedupKey = buildDedupKey({
    providerEventId: input.providerEventId,
    callId,
    tipo: input.tipo,
  });

  const existing = await prisma.dialerChiamataEvento.findUnique({
    where: { campagnaId_dedupKey: { campagnaId: input.campagnaId, dedupKey } },
  });
  if (existing) {
    return { ok: true, duplicate: true, callId };
  }

  const progress = await loadCallProgress(input.campagnaId, callId);
  let skipReason = evaluateEventSkipReason(input.tipo, progress);
  const operatoreId = input.operatoreId;
  const praticaId = input.praticaId;
  const now = new Date();
  const sessionBefore =
    operatoreId && input.tipo === "terminata"
      ? await getOperatoreSession(input.campagnaId, operatoreId)
      : null;
  let shouldAffida = false;

  try {
    await prisma.$transaction(async (tx) => {
      let lockAcquired = true;
      if (!skipReason && input.tipo === "iniziata" && praticaId && operatoreId) {
        lockAcquired = await lockPraticaInCoda(
          input.campagnaId,
          praticaId,
          operatoreId,
          { callId, numero: input.numero },
          tx
        );
        if (!lockAcquired) {
          skipReason = "lock_non_acquisito";
        }
      }

      const applied = skipReason == null;

      await tx.dialerChiamataEvento.create({
        data: {
          campagnaId: input.campagnaId,
          operatoreId: input.operatoreId,
          praticaId: input.praticaId,
          numero: input.numero ?? "",
          tipo: input.tipo,
          esito: input.esito,
          durataSec: input.durataSec ?? 0,
          callId,
          externalCallId: callId,
          providerEventId: input.providerEventId ?? null,
          dedupKey,
          applied,
          skipReason,
          metadata: JSON.stringify(input.metadata ?? {}),
        },
      });

      if (!applied || !operatoreId) return;

      if (input.tipo === "iniziata") {
        await tx.dialerCampagnaOperatore.updateMany({
          where: { campagnaId: input.campagnaId, operatoreId },
          data: {
            sessioneStato: "connecting",
            praticaCorrenteId: praticaId ?? null,
            callIdCorrente: callId,
            lastHeartbeatAt: now,
          },
        });
        return;
      }

      if (input.tipo === "collegata") {
        await tx.dialerCampagnaOperatore.updateMany({
          where: { campagnaId: input.campagnaId, operatoreId },
          data: {
            sessioneStato: "in_chiamata",
            praticaCorrenteId: praticaId ?? null,
            callIdCorrente: callId,
            lastHeartbeatAt: now,
          },
        });
        if (input.affidaSeCollegata !== false && praticaId) {
          shouldAffida = true;
        }
        return;
      }

      if (input.tipo === "risposta") {
        return;
      }

      if (input.tipo === "no_risposta" || input.tipo === "occupato" || input.tipo === "errore") {
        await tx.dialerCampagnaOperatore.updateMany({
          where: { campagnaId: input.campagnaId, operatoreId },
          data: {
            sessioneStato: "disponibile",
            praticaCorrenteId: null,
            callIdCorrente: null,
            postCallFineAt: null,
            lastHeartbeatAt: now,
          },
        });
        if (praticaId) {
          await releasePraticaInCoda(
            input.campagnaId,
            praticaId,
            {
              statoCoda: input.tipo === "no_risposta" ? "non_risposta" : "disponibile",
              ultimoEsito: input.esito ?? input.tipo,
              incrementTentativi: true,
              onlyIfCallId: callId,
            },
            tx
          );
        }
        return;
      }

      if (input.tipo === "terminata") {
        const connected = wasCallConnected(progress, sessionBefore?.sessioneStato);
        const durata = input.durataSec ?? 0;
        const postCallSec = campagna.postCallSec;
        const postCallFineAt = new Date(now.getTime() + postCallSec * 1000);

        if (connected) {
          await tx.dialerCampagnaOperatore.updateMany({
            where: { campagnaId: input.campagnaId, operatoreId },
            data: {
              sessioneStato: "post_call",
              praticaCorrenteId: praticaId ?? sessionBefore?.praticaCorrenteId ?? null,
              callIdCorrente: null,
              postCallFineAt,
              chiamateCount: { increment: 1 },
              durataTotaleSec: { increment: durata },
              lastHeartbeatAt: now,
            },
          });
          if (praticaId) {
            await completePraticaInCoda(input.campagnaId, praticaId, input.esito ?? "terminata", tx);
          }
        } else {
          await tx.dialerCampagnaOperatore.updateMany({
            where: { campagnaId: input.campagnaId, operatoreId },
            data: {
              sessioneStato: "disponibile",
              praticaCorrenteId: null,
              callIdCorrente: null,
              postCallFineAt: null,
              lastHeartbeatAt: now,
            },
          });
          if (praticaId) {
            await releasePraticaInCoda(
              input.campagnaId,
              praticaId,
              {
                statoCoda: "disponibile",
                ultimoEsito: input.esito ?? "non_collegata",
                incrementTentativi: true,
                onlyIfCallId: callId,
              },
              tx
            );
          }
        }
      }
    });
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === "P2002") {
      return { ok: true, duplicate: true, callId };
    }
    throw err;
  }

  if (shouldAffida && praticaId && operatoreId) {
    await affidaPraticaSeCollegata(user, praticaId, operatoreId);
  }

  if (
    !skipReason &&
    operatoreId &&
    (input.tipo === "no_risposta" ||
      input.tipo === "occupato" ||
      input.tipo === "errore" ||
      input.tipo === "terminata")
  ) {
    await notifyOperatorAvailableAfterEvent(user, input.campagnaId, operatoreId);
  }

  return {
    ok: true,
    skipped: !!skipReason,
    skipReason,
    callId,
  };
}

export async function completePostCallIfExpired(user: SessionUser, campagnaId: string, operatoreId: string) {
  const session = await prisma.dialerCampagnaOperatore.findFirst({
    where: { campagnaId, operatoreId, sessioneStato: "post_call" },
  });
  if (!session?.postCallFineAt) return false;
  if (session.postCallFineAt.getTime() > Date.now()) return false;

  await prisma.dialerCampagnaOperatore.update({
    where: { id: session.id },
    data: {
      sessioneStato: "disponibile",
      postCallFineAt: null,
      praticaCorrenteId: null,
      callIdCorrente: null,
      lastHeartbeatAt: new Date(),
    },
  });

  await notifyOperatorAvailableAfterEvent(user, campagnaId, operatoreId);
  return true;
}
