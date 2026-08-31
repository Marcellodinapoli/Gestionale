import type { SessionUser } from "@/lib/permissions";
import { praticaScopeWhere } from "@/lib/gruppoPerimetroScope";
import { can, isManutenzione } from "@/lib/permissions";
import { prisma } from "../lib/instrumentedPrisma";
import { globalMetrics } from "../lib/metrics";
import {
  memoAlertWindow,
  MEMO_ALERT_GRACE_MINUTES,
  MEMO_ALERT_MINUTES_BEFORE,
} from "@/lib/memoAlerts";

/** Replica GET /api/memo-alerts senza HTTP. */
export async function measureMemoAlerts(user: SessionUser) {
  const t0 = performance.now();
  if (isManutenzione(user)) {
    return { totalDurationMs: 0, alerts: 0, skipped: true };
  }

  globalMetrics.startBlock("memo_alerts");
  const baseScope = await praticaScopeWhere(user);
  const now = new Date();
  const memoAtGte = new Date(now.getTime() - MEMO_ALERT_GRACE_MINUTES * 60_000);
  const memoAtLte = new Date(now.getTime() + MEMO_ALERT_MINUTES_BEFORE * 60_000);

  if (can(user, "agenda:view")) {
    await prisma.pratica.findMany({
      where: { AND: [baseScope, { memoAt: { gte: memoAtGte, lte: memoAtLte } }] },
      select: {
        id: true,
        numero: true,
        memoAt: true,
        debitore: { select: { nome: true, cognome: true, telefono: true } },
        mandante: { select: { codice: true } },
      },
      orderBy: { memoAt: "asc" },
      take: 50,
    });
    await prisma.impegnoAgenda.findMany({
      where: {
        userId: user.id,
        completato: false,
        memoAt: { gte: memoAtGte, lte: memoAtLte },
      },
      orderBy: { memoAt: "asc" },
      take: 50,
    });
  }

  await prisma.messaggioInterno.findMany({
    where: { toUserId: user.id, letto: false },
    include: {
      fromUser: { select: { name: true } },
      pratica: {
        select: {
          numero: true,
          debitore: { select: { nome: true, cognome: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
    take: 30,
  });
  globalMetrics.endBlock();

  return {
    totalDurationMs: Math.round(performance.now() - t0),
    memoWindowActive: memoAlertWindow(now, now).active,
  };
}
