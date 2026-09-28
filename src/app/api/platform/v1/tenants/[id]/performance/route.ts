import {
  requirePlatformApiAuth,
  platformJson,
  platformError,
} from "@/lib/platform/platformApiAuth";
import { getNeonPlatformTenantsRepository } from "@/lib/neon/NeonPlatformTenantsRepository";
import { getPerfMonitoringState } from "@/lib/performance/enabled";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/platform/v1/tenants/:id/performance
 * Stato monitoraggio (flag + scadenza).
 */
export async function GET(req: Request, ctx: Ctx) {
  const auth = requirePlatformApiAuth(req);
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  try {
    const repo = getNeonPlatformTenantsRepository();
    const tenant = await repo.getById(id);
    if (!tenant) return platformError("Tenant non trovato", 404);
    const state = await getPerfMonitoringState(id);
    return platformJson({
      tenantId: id,
      slug: tenant.slug,
      ragioneSociale: tenant.ragioneSociale,
      perfMonitoringEnabled: state.enabled,
      perfMonitoringUntil: state.until,
      perfMonitoringActive: state.active,
    });
  } catch (e) {
    return platformError(
      e instanceof Error ? e.message : "Errore lettura monitoraggio",
      500
    );
  }
}

/**
 * PATCH /api/platform/v1/tenants/:id/performance
 * Body: { enabled: boolean, durationHours?: number | null }
 * durationHours assente/null con enabled=true → illimitato.
 */
export async function PATCH(req: Request, ctx: Ctx) {
  const auth = requirePlatformApiAuth(req);
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  try {
    const body = (await req.json()) as {
      enabled?: unknown;
      durationHours?: unknown;
    };
    if (typeof body.enabled !== "boolean") {
      return platformError("enabled (boolean) obbligatorio", 400);
    }
    let durationHours: number | null | undefined = undefined;
    if (body.durationHours === null) {
      durationHours = null;
    } else if (body.durationHours !== undefined) {
      const n = Number(body.durationHours);
      if (!Number.isFinite(n) || n <= 0) {
        return platformError("durationHours deve essere un numero > 0", 400);
      }
      durationHours = n;
    }

    const repo = getNeonPlatformTenantsRepository();
    const result = await repo.setPerfMonitoring(id, {
      enabled: body.enabled,
      durationHours,
    });
    return platformJson(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Errore aggiornamento monitoraggio";
    const status = /non trovato/i.test(msg) ? 404 : 500;
    return platformError(msg, status);
  }
}
