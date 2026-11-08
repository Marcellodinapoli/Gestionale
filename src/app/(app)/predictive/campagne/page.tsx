import { Card, PageHeader } from "@/components/ui";
import { DialerCampagnaForm } from "@/components/predictive-dialer/DialerCampagnaForm";
import { DialerCampagneList } from "@/components/predictive-dialer/DialerSupervisorMonitor";
import { listCampagneForUser } from "@/lib/predictive-dialer/campaigns";
import { requireNavPage } from "@/lib/guard";
import { can } from "@/lib/permissions";
import {
  loadPredictiveGruppoContext,
  operatoriDialerGruppo,
} from "@/lib/predictive-dialer/gruppoContext";
import { PredictiveGruppoPicker } from "@/components/predictive-dialer/PredictiveGruppoPicker";
import { redirect } from "next/navigation";

export default async function PredictiveDialerCampagnePage({
  searchParams,
}: {
  searchParams: Promise<{ gruppo?: string }>;
}) {
  const user = await requireNavPage("dialer");
  if (!can(user, "dialer:manage")) redirect("/predictive");
  const { gruppo: gruppoId } = await searchParams;
  const ctx = await loadPredictiveGruppoContext(user, gruppoId);
  const campagne = await listCampagneForUser(user, {
    gruppoSupervisorId: ctx.canPickGruppo ? ctx.supervisorId : undefined,
  });
  const operatori = operatoriDialerGruppo(ctx.gruppo, ctx.supervisorId);

  return (
    <>
      <PageHeader title="Campagne predictive" subtitle="Crea e gestisci le campagne predictive." />
      {ctx.canPickGruppo ? (
        <PredictiveGruppoPicker
          basePath="/predictive/campagne"
          supervisori={ctx.supervisori}
          supervisorId={ctx.supervisorId}
          gruppoId={gruppoId}
        />
      ) : null}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Nuova campagna">
          <DialerCampagnaForm
            operatori={operatori}
            ownerSupervisorId={ctx.canPickGruppo ? ctx.supervisorId : undefined}
          />
        </Card>
        <Card title="Campagne esistenti">
          <DialerCampagneList campagne={campagne} />
        </Card>
      </div>
    </>
  );
}
