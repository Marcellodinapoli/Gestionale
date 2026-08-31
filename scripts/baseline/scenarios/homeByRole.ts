import type { SessionUser } from "@/lib/permissions";
import { measureHomeSharedBatch, measureHomeAdminBranch } from "./home";
import { globalMetrics } from "../lib/metrics";

export async function measureHomeForRole(user: SessionUser) {
  const t0 = performance.now();
  await measureHomeSharedBatch(user);
  if (user.role === "ADMIN") {
    await measureHomeAdminBranch(user);
  }
  return {
    role: user.role,
    email: user.email,
    totalDurationMs: Math.round(performance.now() - t0),
    ...globalMetrics.summary(),
  };
}
