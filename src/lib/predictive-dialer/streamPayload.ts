import "server-only";
import type { SessionUser } from "@/lib/permissions";
import { loadInvitiOperatore, loadSessioneOperatore } from "@/lib/predictive-dialer/operatorSession";
import { loadCampagnaStats, loadMonitorOperatori } from "@/lib/predictive-dialer/stats";
import { listCampagneForUser } from "@/lib/predictive-dialer/campaigns";
import { runDialerRecovery, touchOperatorHeartbeat } from "@/lib/predictive-dialer/recovery";

export async function loadDialerStreamPayload(user: SessionUser, campagnaId?: string) {
  await runDialerRecovery(user.tenantId, campagnaId);
  await touchOperatorHeartbeat(user.id, campagnaId);

  const inviti = await loadInvitiOperatore(user);
  const sessione = await loadSessioneOperatore(user, campagnaId);

  if (user.role === "ADMIN" || user.role === "SUPERVISOR") {
    const campagne = await listCampagneForUser(user);
    const activeId = campagnaId ?? campagne.find((c) => c.stato === "ATTIVA")?.id;
    const stats = activeId ? await loadCampagnaStats(user.tenantId, activeId) : null;
    const monitor = activeId
      ? await loadMonitorOperatori(activeId, stats?.pacing.pacingRatio)
      : [];
    return { inviti, sessione, campagne, monitor, stats, campagnaId: activeId ?? null };
  }

  return { inviti, sessione, campagne: [], monitor: [], stats: null, campagnaId: campagnaId ?? null };
}
