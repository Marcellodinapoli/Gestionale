import { DialerNav } from "@/components/predictive-dialer/DialerNav";
import { requireModule, requireNavPage } from "@/lib/guard";
import { can } from "@/lib/permissions";

export default async function PredictiveDialerLayout({ children }: { children: React.ReactNode }) {
  await requireModule("dialer");
  const user = await requireNavPage("dialer");

  return (
    <div className="space-y-4">
      <DialerNav
        canManage={can(user, "dialer:manage")}
        canAdmin={can(user, "dialer:admin")}
      />
      {children}
    </div>
  );
}
