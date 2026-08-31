import "server-only";
import type { HomeKpiBundle, HomeKpiContext } from "@/lib/data/contracts/dashboard";
import { isConnectorProvider } from "@/lib/data/factory";
import { createConnectorDashboardRepository } from "@/lib/data/connector/ConnectorDashboardRepository";
import { loadFirestoreHomeKpi } from "@/lib/homeKpi/firestoreHomeKpi";

export async function loadHomeKpi(
  ctx: HomeKpiContext,
  firestoreLoader: () => Promise<HomeKpiBundle>
): Promise<HomeKpiBundle> {
  if (!isConnectorProvider()) return firestoreLoader();

  const repo = createConnectorDashboardRepository();
  return repo.getHomeKpi(ctx);
}

export async function loadHomeKpiAuto(
  ctx: HomeKpiContext,
  deps: Parameters<typeof loadFirestoreHomeKpi>[1]
): Promise<HomeKpiBundle> {
  return loadHomeKpi(ctx, () => loadFirestoreHomeKpi(ctx, deps));
}
