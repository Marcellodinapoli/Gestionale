import type { SessionUser } from "@/lib/permissions";
import { canAccessPratica } from "@/lib/domain";
import {
  acquirePraticaLock,
  getPraticaLockStatus,
  getPraticaWorkContext,
  releasePraticaLock,
  renewPraticaLock,
} from "@/lib/praticaLock";
import { prisma } from "../lib/instrumentedPrisma";
import { globalMetrics } from "../lib/metrics";

export async function measurePraticaOpen(user: SessionUser, praticaId: string) {
  const t0 = performance.now();

  globalMetrics.startBlock("pratica_access_check");
  const accessOk = await canAccessPratica(user, praticaId);
  globalMetrics.endBlock();
  if (!accessOk) throw new Error(`Accesso negato pratica ${praticaId}`);

  globalMetrics.startBlock("pratica_recording_config");
  await prisma.configurazioneSistema.findMany({
    where: { tenantId: user.tenantId },
  });
  globalMetrics.endBlock();

  globalMetrics.startBlock("pratica_main_query");
  const [pratica, incassiSum] = await Promise.all([
    prisma.pratica.findUnique({
      where: { id: praticaId },
      include: {
        debitore: {
          include: {
            recapiti: { orderBy: [{ tipo: "asc" }, { ordine: "asc" }] },
          },
        },
        mandante: { select: { codice: true, ragioneSociale: true } },
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
    prisma.incasso.aggregate({
      where: { praticaId },
      _sum: { importo: true },
    }),
  ]);
  globalMetrics.endBlock();

  globalMetrics.startBlock("pratica_lock_acquire");
  const lockT0 = performance.now();
  const workCtx = await getPraticaWorkContext(user, praticaId);
  const lockAcquireMs = Math.round(performance.now() - lockT0);
  globalMetrics.endBlock();

  return {
    totalDurationMs: Math.round(performance.now() - t0),
    lockAcquireMs,
    canWork: workCtx.canWork,
    pagato: incassiSum._sum.importo ?? 0,
    praticaNumero: pratica?.numero ?? null,
    rateCount: pratica?.rate?.length ?? 0,
    garantiCount: pratica?.garanti?.length ?? 0,
  };
}

export async function measureLockOperations(user: SessionUser, praticaId: string) {
  const results: Record<string, { durationMs: number; prismaCallsDelta: number }> = {};

  function snap() {
    return { calls: globalMetrics.calls.length, t: performance.now() };
  }

  let s = snap();
  await getPraticaLockStatus(praticaId, user.id);
  results.getStatus = {
    durationMs: Math.round(performance.now() - s.t),
    prismaCallsDelta: globalMetrics.calls.length - s.calls,
  };

  s = snap();
  await acquirePraticaLock(praticaId, user.id);
  results.acquire = {
    durationMs: Math.round(performance.now() - s.t),
    prismaCallsDelta: globalMetrics.calls.length - s.calls,
  };

  s = snap();
  await renewPraticaLock(praticaId, user.id);
  results.heartbeat = {
    durationMs: Math.round(performance.now() - s.t),
    prismaCallsDelta: globalMetrics.calls.length - s.calls,
  };

  s = snap();
  await releasePraticaLock(praticaId, user.id);
  results.release = {
    durationMs: Math.round(performance.now() - s.t),
    prismaCallsDelta: globalMetrics.calls.length - s.calls,
  };

  return results;
}
