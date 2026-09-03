import { DialerNav } from "@/components/predictive-dialer/DialerNav";
import { requirePermission } from "@/lib/guard";
import { can } from "@/lib/permissions";

export default async function PredictiveDialerLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePermission("dialer:operate");

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
