import { requirePlatformApiAuth, platformJson, platformError } from "@/lib/platform/platformApiAuth";
import { getNeonPlatformTenantsRepository } from "@/lib/neon/NeonPlatformTenantsRepository";
import {
  VERTICAL_PROFILES,
  type VerticalProfile,
} from "@/lib/platform/modules";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const auth = requirePlatformApiAuth(req);
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  try {
    const repo = getNeonPlatformTenantsRepository();
    const modules = await repo.getModules(id);
    return platformJson(modules);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Errore moduli";
    return platformError(msg, /non trovato/i.test(msg) ? 404 : 500);
  }
}

export async function PUT(req: Request, ctx: Ctx) {
  const auth = requirePlatformApiAuth(req);
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  try {
    const body = (await req.json()) as {
      enabledModules?: string[];
      verticalProfile?: string;
    };
    if (!Array.isArray(body.enabledModules)) {
      return platformError("enabledModules (array) obbligatorio", 400);
    }
    let verticalProfile: VerticalProfile | undefined;
    if (body.verticalProfile != null) {
      const v = String(body.verticalProfile).trim().toUpperCase();
      if (!(VERTICAL_PROFILES as readonly string[]).includes(v)) {
        return platformError("verticalProfile non valido", 400);
      }
      verticalProfile = v as VerticalProfile;
    }
    const repo = getNeonPlatformTenantsRepository();
    const modules = await repo.updateModules(id, {
      enabledModules: body.enabledModules.map(String),
      verticalProfile,
    });
    return platformJson(modules);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Errore aggiornamento moduli";
    return platformError(msg, /non trovato/i.test(msg) ? 404 : 400);
  }
}
