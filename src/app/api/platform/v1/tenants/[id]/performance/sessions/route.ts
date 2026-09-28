import {
  requirePlatformApiAuth,
  platformJson,
  platformError,
} from "@/lib/platform/platformApiAuth";
import { getNeonPlatformTenantsRepository } from "@/lib/neon/NeonPlatformTenantsRepository";
import { listPerfSessionsForTenant } from "@/lib/performance/platformRead";
import { getPerfMonitoringState } from "@/lib/performance/enabled";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/platform/v1/tenants/:id/performance/sessions */
export async function GET(req: Request, ctx: Ctx) {
  const auth = requirePlatformApiAuth(req);
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  try {
    const repo = getNeonPlatformTenantsRepository();
    const tenant = await repo.getById(id);
    if (!tenant) return platformError("Tenant non trovato", 404);

    const takeRaw = new URL(req.url).searchParams.get("take");
    const take = takeRaw ? Number(takeRaw) : 50;
    const [sessions, state] = await Promise.all([
      listPerfSessionsForTenant(id, { take }),
      getPerfMonitoringState(id),
    ]);
    return platformJson({
      tenantId: id,
      slug: tenant.slug,
      ragioneSociale: tenant.ragioneSociale,
      perfMonitoringEnabled: state.active,
      perfMonitoringUntil: state.until,
      sessions,
    });
  } catch (e) {
    return platformError(
      e instanceof Error ? e.message : "Errore lettura sessioni performance",
      500
    );
  }
}
