import { requirePlatformApiAuth, platformJson, platformError } from "@/lib/platform/platformApiAuth";
import { getNeonPlatformTenantsRepository } from "@/lib/neon/NeonPlatformTenantsRepository";
import type { UpdateTenantPlatformInput } from "@/lib/data/contracts/platformTenants";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const auth = requirePlatformApiAuth(req);
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  try {
    const includeModules =
      new URL(req.url).searchParams.get("includeModules") === "1";
    const repo = getNeonPlatformTenantsRepository();
    const tenant = await repo.getById(id, { includeModules });
    if (!tenant) return platformError("Tenant non trovato", 404);
    return platformJson(tenant);
  } catch (e) {
    return platformError(e instanceof Error ? e.message : "Errore lettura tenant", 500);
  }
}

export async function PATCH(req: Request, ctx: Ctx) {
  const auth = requirePlatformApiAuth(req);
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  try {
    const body = (await req.json()) as UpdateTenantPlatformInput;
    const repo = getNeonPlatformTenantsRepository();
    const updated = await repo.updateAnagrafica(id, body);
    return platformJson(updated);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Errore aggiornamento tenant";
    const status = /non trovato/i.test(msg) ? 404 : /già|obbligator/i.test(msg) ? 400 : 500;
    return platformError(msg, status);
  }
}
