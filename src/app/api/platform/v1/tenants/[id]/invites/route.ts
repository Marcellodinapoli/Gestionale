import { requirePlatformApiAuth, platformJson, platformError } from "@/lib/platform/platformApiAuth";
import { getNeonPlatformTenantsRepository } from "@/lib/neon/NeonPlatformTenantsRepository";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Crea invito ADMIN monouso. Restituisce `token` in chiaro una sola volta.
 * Non invia email in questo blocco.
 */
export async function POST(req: Request, ctx: Ctx) {
  const auth = requirePlatformApiAuth(req);
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  try {
    const body = (await req.json()) as {
      email?: string;
      role?: string;
      expiresInHours?: number;
      createdByPlatformAdmin?: string;
    };
    const repo = getNeonPlatformTenantsRepository();
    const invite = await repo.createInvite({
      tenantId: id,
      email: String(body.email || ""),
      role: body.role,
      expiresInHours:
        typeof body.expiresInHours === "number" ? body.expiresInHours : undefined,
      createdByPlatformAdmin: String(
        body.createdByPlatformAdmin || "platform-api"
      ),
    });
    return platformJson(invite, 201);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Errore creazione invito";
    return platformError(msg, /non trovato/i.test(msg) ? 404 : 400);
  }
}
