import "server-only";
import { can, type SessionUser } from "@/lib/permissions";
import { loadInvitiOperatore, loadSessioneOperatore } from "@/lib/predictive-dialer/operatorSession";
import { loadCampagnaStats, loadMonitorOperatori } from "@/lib/predictive-dialer/stats";
import { listCampagneForUser } from "@/lib/predictive-dialer/campaigns";
import { runDialerRecovery, touchOperatorHeartbeat } from "@/lib/predictive-dialer/recovery";

export async function loadDialerStreamPayload(user: SessionUser, campagnaId?: string) {
  await runDialerRecovery(user.tenantId, campagnaId);
  await touchOperatorHeartbeat(user.id, campagnaId);

  const inviti = await loadInvitiOperatore(user);
  const sessione = await loadSessioneOperatore(user, campagnaId);

  if (can(user, "dialer:manage")) {
    const campagne = await listCampagneForUser(user);
    // Solo campagnaId esplicito: niente auto-pick della prima ATTIVA.
    const activeId =
      campagnaId && campagne.some((c) => c.id === campagnaId) ? campagnaId : undefined;
    const stats = activeId ? await loadCampagnaStats(user.tenantId, activeId) : null;
    const monitor = activeId
      ? await loadMonitorOperatori(activeId, stats?.pacing.pacingRatio)
      : [];
    return { inviti, sessione, campagne, monitor, stats, campagnaId: activeId ?? null };
  }

  return { inviti, sessione, campagne: [], monitor: [], stats: null, campagnaId: campagnaId ?? null };
}
