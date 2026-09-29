import { PageHeader } from "@/components/ui";
import { DialerSupervisorMonitor } from "@/components/predictive-dialer/DialerSupervisorMonitor";
import { listCampagneForUser } from "@/lib/predictive-dialer/campaigns";
import { loadCampagnaStats, loadMonitorOperatori } from "@/lib/predictive-dialer/stats";
import { requireNavPage } from "@/lib/guard";
import { can } from "@/lib/permissions";
import { redirect } from "next/navigation";

export default async function PredictiveDialerMonitorPage({
  searchParams,
}: {
  searchParams: Promise<{ campagnaId?: string }>;
}) {
  const user = await requireNavPage("dialer");
  if (!can(user, "dialer:manage")) redirect("/predictive-dialer");
  const sp = await searchParams;
  const campagne = await listCampagneForUser(user);
  const campagneAttive = campagne.filter((c) => c.stato === "ATTIVA");
  const selectedId =
    sp.campagnaId && campagneAttive.some((c) => c.id === sp.campagnaId)
      ? sp.campagnaId
      : undefined;

  const [initialStats, initialMonitor] = selectedId
    ? await Promise.all([
        loadCampagnaStats(user.tenantId, selectedId),
        loadMonitorOperatori(selectedId),
      ])
    : [null, []];

  return (
    <>
      <PageHeader
        title="Monitor dialer"
        subtitle="Scegli una campagna attiva da monitorare: clienti, operatori, esiti e pacing."
      />
      <DialerSupervisorMonitor
        key={selectedId ?? "nessuna"}
        campagnaId={selectedId}
        campagneAttive={campagneAttive.map((c) => ({
          id: c.id,
          nome: c.nome,
          stato: c.stato,
          operatoriCount: c.operatoriCount,
          praticheCount: c.praticheCount,
        }))}
        initialStats={initialStats}
        initialMonitor={initialMonitor}
        showCampagnaHeader
      />
    </>
  );
}
