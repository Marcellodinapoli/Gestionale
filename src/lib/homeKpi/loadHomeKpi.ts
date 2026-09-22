import "server-only";
import type { HomeKpiBundle, HomeKpiContext } from "@/lib/data/contracts/dashboard";
import { getDashboardRepository, isSqlBackendProvider } from "@/lib/data/factory";
import { loadFirestoreHomeKpi } from "@/lib/homeKpi/firestoreHomeKpi";

export async function loadHomeKpi(
  ctx: HomeKpiContext,
  firestoreLoader: () => Promise<HomeKpiBundle>
): Promise<HomeKpiBundle> {
  if (!isSqlBackendProvider()) return firestoreLoader();
  return getDashboardRepository().getHomeKpi(ctx);
}

export async function loadHomeKpiAuto(
  ctx: HomeKpiContext,
  deps: Parameters<typeof loadFirestoreHomeKpi>[1]
): Promise<HomeKpiBundle> {
  return loadHomeKpi(ctx, () => loadFirestoreHomeKpi(ctx, deps));
}
