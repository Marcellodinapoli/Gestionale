import { NextResponse } from "next/server";
import { isNeonConfigured } from "@/lib/neon/client";
import { getNeonPlatformTenantsRepository } from "@/lib/neon/NeonPlatformTenantsRepository";

export const runtime = "nodejs";

const INVALID = NextResponse.json(
  { error: "Invito non valido o scaduto", code: "INVITE_INVALID" },
  { status: 400 }
);

/**
 * Preview pubblica invito (sola lettura).
 * Nessuna PLATFORM_API_KEY, nessuna sessione, non consuma UsedAt.
 */
export async function GET(req: Request) {
  if (!isNeonConfigured()) {
    return NextResponse.json({ error: "Servizio non disponibile" }, { status: 503 });
  }

  const token = new URL(req.url).searchParams.get("token")?.trim() || "";
  if (!token) return INVALID;

  try {
    const lookup = await getNeonPlatformTenantsRepository().verifyInviteToken(token);
    if (!lookup.valid || !lookup.email) return INVALID;
    return NextResponse.json({
      email: lookup.email,
      ragioneSociale: lookup.ragioneSociale || null,
      slug: lookup.slug || null,
      tenantId: lookup.tenantId || null,
    });
  } catch (e) {
    console.error("[invite-preview]", e);
    return INVALID;
  }
}
