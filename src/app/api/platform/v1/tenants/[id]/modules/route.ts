import { requirePlatformApiAuth, platformJson, platformError } from "@/lib/platform/platformApiAuth";
import { getNeonPlatformTenantsRepository } from "@/lib/neon/NeonPlatformTenantsRepository";
import {
  VERTICAL_PROFILES,
  type VerticalProfile,
} from "@/lib/platform/modules";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** Firebase Callable a volte serializza List come mappa `{ "0": "a", "1": "b" }`. */
function asStringArray(value: unknown): string[] | null {
  if (Array.isArray(value)) return value.map(String);
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (!entries.length) return [];
    const numeric = entries.every(([k]) => /^\d+$/.test(k));
    if (!numeric) return null;
    return entries
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .map(([, v]) => String(v));
  }
  return null;
}

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
      enabledModules?: unknown;
      enabledPackages?: unknown;
      verticalProfile?: string;
    };
    const enabledModules = asStringArray(body.enabledModules);
    const enabledPackages = asStringArray(body.enabledPackages);
    if (enabledModules == null && enabledPackages == null) {
      return platformError(
        "enabledModules o enabledPackages (array) obbligatorio",
        400
      );
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
      enabledModules: enabledModules ?? undefined,
      enabledPackages: enabledPackages ?? undefined,
      verticalProfile,
    });
    return platformJson(modules);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Errore aggiornamento moduli";
    return platformError(msg, /non trovato/i.test(msg) ? 404 : 400);
  }
}
