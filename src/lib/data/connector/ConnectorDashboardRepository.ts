import "server-only";
import { connectorFetch } from "@/lib/data/connector/ConnectorClient";
import type { DashboardRepository, HomeKpiBundle, HomeKpiContext } from "@/lib/data/contracts/dashboard";

export class ConnectorDashboardRepository implements DashboardRepository {
  async getHomeKpi(ctx: HomeKpiContext): Promise<HomeKpiBundle> {
    const data = await connectorFetch<HomeKpiBundle & { totalMs?: number }>(
      `/api/v1/tenants/${encodeURIComponent(ctx.tenantSlug)}/dashboard/home`,
      {
        method: "POST",
        body: {
          role: ctx.role,
          userId: ctx.userId,
          sedeScopeId: ctx.sedeScopeId,
          lavorateDate: ctx.lavorateDate,
          incMandante: ctx.incMandante,
          incPerimetro: ctx.incPerimetro,
          scope: ctx.scope,
          incassiScope: ctx.incassiScope,
          includeAdmin: ctx.includeAdmin,
          includeAmministrazione: ctx.includeAmministrazione,
          vistaGruppoLavorate: ctx.vistaGruppoLavorate,
          gruppoMandanti: ctx.gruppoMandanti,
          memberIds: ctx.memberIds,
          sedeRicaviId: ctx.sedeRicaviId,
          mostraRicavi: ctx.mostraRicavi,
        },
      }
    );
    return {
      shared: data.shared,
      admin: data.admin,
      amministrazione: data.amministrazione,
      meta: {
        ...data.meta,
        roundTrips: 1,
      },
    };
  }
}

export function createConnectorDashboardRepository() {
  return new ConnectorDashboardRepository();
}
