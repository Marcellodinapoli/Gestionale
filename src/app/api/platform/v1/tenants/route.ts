import { requirePlatformApiAuth, platformJson, platformError } from "@/lib/platform/platformApiAuth";
import { getNeonPlatformTenantsRepository } from "@/lib/neon/NeonPlatformTenantsRepository";
import {
  isTenantStatus,
  type CreateTenantPlatformInput,
  type TenantStatus,
} from "@/lib/data/contracts/platformTenants";
import {
  modulesFromPackages,
  VERTICAL_PROFILES,
  type VerticalProfile,
} from "@/lib/platform/modules";

export const runtime = "nodejs";

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

function normalizeCreateModules(
  raw: CreateTenantPlatformInput["modules"] | undefined
): CreateTenantPlatformInput["modules"] | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const enabledModules = asStringArray(raw.enabledModules);
  const enabledPackages = asStringArray(raw.enabledPackages);
  let verticalProfile: VerticalProfile | undefined;
  if (raw.verticalProfile != null) {
    const v = String(raw.verticalProfile).trim().toUpperCase();
    if ((VERTICAL_PROFILES as readonly string[]).includes(v)) {
      verticalProfile = v as VerticalProfile;
    }
  }
  if (enabledModules == null && enabledPackages == null && !verticalProfile) {
    return undefined;
  }
  const modules =
    enabledPackages != null
      ? modulesFromPackages(enabledPackages)
      : enabledModules ?? undefined;
  return {
    enabledModules: modules,
    enabledPackages: enabledPackages ?? undefined,
    verticalProfile,
  };
}

export async function GET(req: Request) {
  const auth = requirePlatformApiAuth(req);
  if (!auth.ok) return auth.response;

  try {
    const url = new URL(req.url);
    const statusRaw = url.searchParams.get("status") || "";
    const status = isTenantStatus(statusRaw) ? (statusRaw as TenantStatus) : undefined;
    const q = url.searchParams.get("q") || undefined;
    const take = Number(url.searchParams.get("take") || 50);
    const skip = Number(url.searchParams.get("skip") || 0);

    const repo = getNeonPlatformTenantsRepository();
    const result = await repo.list({ status, q, take, skip });
    return platformJson(result);
  } catch (e) {
    return platformError(e instanceof Error ? e.message : "Errore elenco tenant", 500);
  }
}

export async function POST(req: Request) {
  const auth = requirePlatformApiAuth(req);
  if (!auth.ok) return auth.response;

  try {
    const body = (await req.json()) as CreateTenantPlatformInput;
    const modules = normalizeCreateModules(body.modules);
    const repo = getNeonPlatformTenantsRepository();
    const created = await repo.create({ ...body, modules });
    // Sempre persisti i pacchetti BO (anche lista vuota → solo base gestionale).
    if (modules?.enabledModules != null || modules?.enabledPackages != null) {
      await repo.updateModules(created.id, {
        enabledModules: modules.enabledModules,
        enabledPackages: modules.enabledPackages,
        verticalProfile: modules.verticalProfile,
      });
    }
    const withModules = await repo.getById(created.id, { includeModules: true });
    return platformJson(withModules ?? created, 201);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Errore creazione tenant";
    const status = /già in uso|obbligator/i.test(msg) ? 400 : 500;
    return platformError(msg, status);
  }
}
