import { PageHeader } from "@/components/ui";
import { DialerOperatorPanel } from "@/components/predictive-dialer/DialerOperatorPanel";
import { requirePermission } from "@/lib/guard";

export default async function PredictiveDialerOperatorePage() {
  await requirePermission("dialer:operate");

  return (
    <>
      <PageHeader
        title="Predictive Dialer"
        subtitle="Accetta le campagne attive e gestisci la tua sessione di chiamata."
      />
      <DialerOperatorPanel />
    </>
  );
}
