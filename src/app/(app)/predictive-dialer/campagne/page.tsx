import { Card, PageHeader } from "@/components/ui";
import { DialerCampagnaForm } from "@/components/predictive-dialer/DialerCampagnaForm";
import { DialerCampagneList } from "@/components/predictive-dialer/DialerSupervisorMonitor";
import { listCampagneForUser } from "@/lib/predictive-dialer/campaigns";
import { requireNavPage } from "@/lib/guard";
import { can } from "@/lib/permissions";
import { usersDbFromUser } from "@/lib/usersRepo";
import { getGruppoLavoro } from "@/lib/gruppoLavoro";
import { redirect } from "next/navigation";

export default async function PredictiveDialerCampagnePage() {
  const user = await requireNavPage("dialer");
  if (!can(user, "dialer:manage")) redirect("/predictive-dialer");
  const [campagne, gruppo] = await Promise.all([
    listCampagneForUser(user),
    getGruppoLavoro(user),
  ]);
  const operatori =
    user.role === "SUPERVISOR"
      ? gruppo.members.filter((m) => m.role === "OPERATOR" || m.id === user.id)
      : await usersDbFromUser(user).findMany({
          where: {
            tenantId: user.tenantId,
            active: true,
            role: { in: ["OPERATOR", "SUPERVISOR"] },
          },
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        });

  return (
    <>
      <PageHeader title="Campagne dialer" subtitle="Crea e gestisci le campagne predictive." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Nuova campagna">
          <DialerCampagnaForm operatori={operatori} />
        </Card>
        <Card title="Campagne esistenti">
          <DialerCampagneList campagne={campagne} />
        </Card>
      </div>
    </>
  );
}
