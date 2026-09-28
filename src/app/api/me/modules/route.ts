import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getTenantPlatformConfig } from "@/lib/platform/tenantProfile";

export const runtime = "nodejs";

/** Snapshot moduli tenant per soft-sync del menu (polling client). */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }
  const platform = await getTenantPlatformConfig(user.tenantId, user.tenantSlug);
  return NextResponse.json(
    { enabledModules: platform.enabledModules },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
