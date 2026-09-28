import { NextResponse } from "next/server";
import { AcceptInviteError, acceptInvite } from "@/lib/neon/acceptInvite";
import { isNeonConfigured } from "@/lib/neon/client";
import { clearSession } from "@/lib/auth";
import { getNeonPlatformTenantsRepository } from "@/lib/neon/NeonPlatformTenantsRepository";

export const runtime = "nodejs";

/**
 * Accettazione invito pubblico (set password + crea ADMIN).
 * Nessuna PLATFORM_API_KEY. Chiude eventuali sessioni precedenti (es. demo).
 */
export async function POST(req: Request) {
  if (!isNeonConfigured()) {
    return NextResponse.json({ error: "Servizio non disponibile" }, { status: 503 });
  }

  let body: { token?: unknown; password?: unknown; passwordConfirm?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Richiesta non valida" }, { status: 400 });
  }

  const token = String(body.token ?? "").trim();
  const password = String(body.password ?? "");
  const passwordConfirm = String(body.passwordConfirm ?? "");

  if (!token || !password || !passwordConfirm) {
    return NextResponse.json({ error: "Dati incompleti" }, { status: 400 });
  }

  try {
    // Evita di restare loggati su un altro tenant (es. demo) dopo l'attivazione.
    await clearSession();

    const result = await acceptInvite(token, password, passwordConfirm);
    const repo = getNeonPlatformTenantsRepository();
    let tenantSlug: string | null = null;
    let ragioneSociale: string | null = null;
    try {
      const tenant = await repo.getById(result.tenantId);
      tenantSlug = tenant?.slug ?? null;
      ragioneSociale = tenant?.ragioneSociale ?? null;
      // Prima attivazione admin → azienda operativa (altrimenti login fallisce su Inactive).
      if (tenant && tenant.status === "IN_CONFIGURAZIONE") {
        await repo.activate(result.tenantId);
      }
    } catch (e) {
      console.error("[accept-invite] post-activate", e);
    }

    return NextResponse.json(
      {
        ok: true,
        userId: result.userId,
        tenantId: result.tenantId,
        email: result.email,
        role: result.role,
        tenantSlug,
        ragioneSociale,
      },
      { status: 201 }
    );
  } catch (e) {
    if (e instanceof AcceptInviteError) {
      const status =
        e.code === "PASSWORD_MISMATCH" || e.code === "PASSWORD_WEAK"
          ? 400
          : e.code === "USER_EXISTS"
            ? 409
            : 400;
      return NextResponse.json({ error: e.message, code: e.code }, { status });
    }
    console.error("[accept-invite]", e);
    return NextResponse.json({ error: "Operazione non riuscita" }, { status: 500 });
  }
}
