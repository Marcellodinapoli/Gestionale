import "server-only";
import { prisma } from "@/lib/prisma";import {
  DIALER_DEFAULT_LOCK_TIMEOUT_SEC,
  DIALER_EVENTI_CONCLUSIVI,
  DIALER_SESSION_HEARTBEAT_TIMEOUT_SEC,
} from "@/lib/predictive-dialer/constants";
import { releasePraticaInCoda } from "@/lib/predictive-dialer/queueLock";
import {
  notifyDialerAfterAvailabilityChange,
  notifyDialerOperatorAvailability,
} from "@/lib/predictive-dialer/dialerSync";
import type { SessionUser } from "@/lib/permissions";

async function hasConclusiveEventForCall(campagnaId: string, callId: string): Promise<boolean> {
  if (!callId) return false;
  const count = await prisma.dialerChiamataEvento.count({
    where: {
      campagnaId,
      callId,
      applied: true,
      tipo: { in: [...DIALER_EVENTI_CONCLUSIVI] },
    },
  });
  return count > 0;
}

/** Rilascia lock pratica scaduti (webhook persi / nessun evento conclusivo). Idempotente. */
export async function releaseExpiredPraticaLocks(tenantId: string, campagnaId?: string) {
  const now = Date.now();
  const rows = await prisma.dialerCampagnaPratica.findMany({
    where: {
      stato: "in_lavorazione",
      lockedAt: { not: null },
      campagna: {
        tenantId,
        stato: "ATTIVA",
        ...(campagnaId ? { id: campagnaId } : {}),
      },
    },
    include: { campagna: { select: { lockTimeoutSec: true } } },
  });

  for (const row of rows) {
    const timeoutSec = row.campagna.lockTimeoutSec ?? DIALER_DEFAULT_LOCK_TIMEOUT_SEC;
    const lockedAtMs = row.lockedAt!.getTime();
    if (lockedAtMs + timeoutSec * 1000 > now) continue;

    if (row.lockedByCallId && (await hasConclusiveEventForCall(row.campagnaId, row.lockedByCallId))) {
      continue;
    }

    await releasePraticaInCoda(row.campagnaId, row.praticaId, {
      statoCoda: "disponibile",
      ultimoEsito: "lock_timeout",
      incrementTentativi: true,
      onlyIfLocked: true,
      onlyIfCallId: row.lockedByCallId ?? undefined,
    });

    if (row.lockedByOperatoreId && row.lockedByCallId) {
      await prisma.dialerCampagnaOperatore.updateMany({
        where: {
          campagnaId: row.campagnaId,
          operatoreId: row.lockedByOperatoreId,
          sessioneStato: "connecting",
          callIdCorrente: row.lockedByCallId,
        },
        data: {
          sessioneStato: "disponibile",
          praticaCorrenteId: null,
          callIdCorrente: null,
        },
      });
    }
  }
}

/** Recupera sessioni operatore stale (browser chiuso, rete persa). */
export async function recoverStaleOperatorSessions(tenantId: string, campagnaId?: string) {
  const staleBefore = new Date(Date.now() - DIALER_SESSION_HEARTBEAT_TIMEOUT_SEC * 1000);
  const rows = await prisma.dialerCampagnaOperatore.findMany({
    where: {
      sessioneStato: { in: ["connecting", "in_chiamata"] },
      accettatoAt: { not: null },
      uscitaAt: null,
      campagna: { tenantId, stato: "ATTIVA", ...(campagnaId ? { id: campagnaId } : {}) },
      OR: [{ lastHeartbeatAt: { lt: staleBefore } }, { lastHeartbeatAt: null, accettatoAt: { lt: staleBefore } }],
    },
    include: { operatore: { select: { interno: true } } },
  });

  for (const row of rows) {
    if (row.sessioneStato === "connecting") {
      if (row.praticaCorrenteId && row.callIdCorrente) {
        await releasePraticaInCoda(row.campagnaId, row.praticaCorrenteId, {
          statoCoda: "disponibile",
          ultimoEsito: "sessione_stale_connecting",
          incrementTentativi: true,
          onlyIfLocked: true,
          onlyIfCallId: row.callIdCorrente,
        });
      }
      await prisma.dialerCampagnaOperatore.update({
        where: { id: row.id },
        data: {
          sessioneStato: "disponibile",
          praticaCorrenteId: null,
          callIdCorrente: null,
        },
      });
      await notifyDialerOperatorAvailability(
        { id: row.operatoreId, tenantId, role: "OPERATOR" } as SessionUser,
        row.campagnaId,
        { operatoreId: row.operatoreId, interno: row.operatore.interno },
        true
      );
      await notifyDialerAfterAvailabilityChange(
        { id: row.operatoreId, tenantId, role: "OPERATOR" } as SessionUser,
        row.campagnaId
      );
    } else if (row.sessioneStato === "in_chiamata") {
      if (row.callIdCorrente && !(await hasConclusiveEventForCall(row.campagnaId, row.callIdCorrente))) {
        if (row.praticaCorrenteId) {
          await releasePraticaInCoda(row.campagnaId, row.praticaCorrenteId, {
            statoCoda: "disponibile",
            ultimoEsito: "sessione_stale_in_chiamata",
            incrementTentativi: false,
            onlyIfLocked: true,
            onlyIfCallId: row.callIdCorrente,
          });
        }
      }
      await prisma.dialerCampagnaOperatore.update({
        where: { id: row.id },
        data: {
          sessioneStato: "offline",
          callIdCorrente: null,
        },
      });
      await notifyDialerOperatorAvailability(
        { id: row.operatoreId, tenantId, role: "OPERATOR" } as SessionUser,
        row.campagnaId,
        { operatoreId: row.operatoreId, interno: row.operatore.interno },
        false
      );
    }
  }
}

export async function runDialerRecovery(tenantId: string, campagnaId?: string) {
  await releaseExpiredPraticaLocks(tenantId, campagnaId);
  await recoverStaleOperatorSessions(tenantId, campagnaId);
}

export async function touchOperatorHeartbeat(operatoreId: string, campagnaId?: string) {
  const now = new Date();
  await prisma.dialerCampagnaOperatore.updateMany({
    where: {
      operatoreId,
      accettatoAt: { not: null },
      uscitaAt: null,
      sessioneStato: { notIn: ["fuori", "offline"] },
      ...(campagnaId ? { campagnaId } : {}),
    },
    data: { lastHeartbeatAt: now },
  });
}
