import { PageHeader } from "@/components/ui";
import { DialerSupervisorMonitor } from "@/components/predictive-dialer/DialerSupervisorMonitor";
import { listCampagneForUser } from "@/lib/predictive-dialer/campaigns";
import { loadCampagnaStats, loadMonitorOperatori } from "@/lib/predictive-dialer/stats";
import { requirePermission } from "@/lib/guard";

export default async function PredictiveDialerMonitorPage() {
  const user = await requirePermission("dialer:manage");
  const campagne = await listCampagneForUser(user);
  const activeId = campagne.find((c) => c.stato === "ATTIVA")?.id;
  const [initialStats, initialMonitor] = activeId
    ? await Promise.all([
        loadCampagnaStats(user.tenantId, activeId),
        loadMonitorOperatori(activeId),
      ])
    : [null, []];

  return (
    <>
      <PageHeader
        title="Monitor dialer"
        subtitle="Panoramica in tempo reale della campagna attiva: clienti, operatori, esiti e pacing."
      />
      <DialerSupervisorMonitor
        initialStats={initialStats}
        initialMonitor={initialMonitor}
        showCampagnaHeader
      />
    </>
  );
}
