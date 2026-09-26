import { NextResponse } from "next/server";
import { AcceptInviteError, acceptInvite } from "@/lib/neon/acceptInvite";
import { isNeonConfigured } from "@/lib/neon/client";

export const runtime = "nodejs";

/**
 * Accettazione invito pubblico (set password + crea ADMIN).
 * Nessuna PLATFORM_API_KEY, nessuna sessione gestionale.
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
    const result = await acceptInvite(token, password, passwordConfirm);
    return NextResponse.json(
      {
        ok: true,
        userId: result.userId,
        tenantId: result.tenantId,
        email: result.email,
        role: result.role,
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
