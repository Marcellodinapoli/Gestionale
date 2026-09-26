import { requirePlatformApiAuth, platformJson, platformError } from "@/lib/platform/platformApiAuth";
import { getNeonPlatformTenantsRepository } from "@/lib/neon/NeonPlatformTenantsRepository";
import {
  isTenantStatus,
  type CreateTenantPlatformInput,
  type TenantStatus,
} from "@/lib/data/contracts/platformTenants";

export const runtime = "nodejs";

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
    const repo = getNeonPlatformTenantsRepository();
    const created = await repo.create(body);
    const withModules = await repo.getById(created.id, { includeModules: true });
    return platformJson(withModules ?? created, 201);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Errore creazione tenant";
    const status = /già in uso|obbligator/i.test(msg) ? 400 : 500;
    return platformError(msg, status);
  }
}
