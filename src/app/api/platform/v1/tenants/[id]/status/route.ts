import { requirePlatformApiAuth, platformJson, platformError } from "@/lib/platform/platformApiAuth";
import { getNeonPlatformTenantsRepository } from "@/lib/neon/NeonPlatformTenantsRepository";
import { isTenantStatus } from "@/lib/data/contracts/platformTenants";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const auth = requirePlatformApiAuth(req);
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  try {
    const body = (await req.json()) as { status?: string };
    const status = String(body.status || "").trim();
    if (!isTenantStatus(status)) {
      return platformError(
        "status deve essere IN_CONFIGURAZIONE | ATTIVA | SOSPESA",
        400
      );
    }
    const repo = getNeonPlatformTenantsRepository();
    const updated = await repo.updateStatus(id, status);
    return platformJson(updated);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Errore cambio stato";
    const status = /non trovato/i.test(msg) ? 404 : 400;
    return platformError(msg, status);
  }
}
