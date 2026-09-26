import { requirePlatformApiAuth, platformJson, platformError } from "@/lib/platform/platformApiAuth";
import { getNeonPlatformTenantsRepository } from "@/lib/neon/NeonPlatformTenantsRepository";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const auth = requirePlatformApiAuth(req);
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  try {
    const body = (await req.json().catch(() => ({}))) as { reason?: string };
    const repo = getNeonPlatformTenantsRepository();
    const updated = await repo.suspend(id, String(body.reason || ""));
    return platformJson(updated);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Errore sospensione";
    const status = /non trovato/i.test(msg) ? 404 : 400;
    return platformError(msg, status);
  }
}
