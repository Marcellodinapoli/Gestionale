import {
  requirePlatformApiAuth,
  platformJson,
  platformError,
} from "@/lib/platform/platformApiAuth";
import { getNeonPlatformTenantsRepository } from "@/lib/neon/NeonPlatformTenantsRepository";
import { listPerfEventsForSession } from "@/lib/performance/platformRead";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string; sessionId: string }> };

/** GET /api/platform/v1/tenants/:id/performance/sessions/:sessionId/events */
export async function GET(req: Request, ctx: Ctx) {
  const auth = requirePlatformApiAuth(req);
  if (!auth.ok) return auth.response;
  const { id, sessionId } = await ctx.params;
  try {
    const repo = getNeonPlatformTenantsRepository();
    const tenant = await repo.getById(id);
    if (!tenant) return platformError("Tenant non trovato", 404);

    const takeRaw = new URL(req.url).searchParams.get("take");
    const take = takeRaw ? Number(takeRaw) : 200;
    const events = await listPerfEventsForSession(id, sessionId, { take });
    return platformJson({
      tenantId: id,
      sessionId,
      events,
    });
  } catch (e) {
    return platformError(
      e instanceof Error ? e.message : "Errore lettura eventi performance",
      500
    );
  }
}
