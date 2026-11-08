import { NextResponse } from "next/server";

import { loadSessionUser } from "@/lib/data/operationalAccess";
import { outcomeFromSessionUser } from "@/lib/assistenza/assistenzaRoleAccess";
import {
  assertAssistenzaRoleVerifySecret,
  assistenzaRoleVerifyHeaderName,
} from "@/lib/assistenza/assistenzaRoleVerifyAuth";

export const runtime = "nodejs";

type RoleVerifyBody = {
  gestionaleUserId?: string;
  gestionaleTenantId?: string;
};

/**
 * Verifica ruolo corrente su DB (Neon) per la callable gestionaleHelp.
 * Solo server-to-server: secret condiviso con Cloud Functions (non esposto al browser).
 */
export async function POST(req: Request) {
  const secretHeader = req.headers.get(assistenzaRoleVerifyHeaderName());
  if (!assertAssistenzaRoleVerifySecret(secretHeader)) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  let body: RoleVerifyBody = {};
  try {
    body = (await req.json()) as RoleVerifyBody;
  } catch {
    return NextResponse.json({ error: "Body non valido" }, { status: 400 });
  }

  const gestionaleUserId = String(body.gestionaleUserId ?? "").trim();
  const gestionaleTenantId = String(body.gestionaleTenantId ?? "").trim();
  if (!gestionaleUserId || !gestionaleTenantId) {
    return NextResponse.json(
      { error: "gestionaleUserId e gestionaleTenantId obbligatori" },
      { status: 400 },
    );
  }

  const user = await loadSessionUser(gestionaleUserId, gestionaleTenantId);
  const outcome = outcomeFromSessionUser(
    user ? { active: user.active, role: user.role } : null,
  );

  if (outcome.status === "allowed") {
    return NextResponse.json({
      role: outcome.role,
      assistenzaView: true,
    });
  }

  if (outcome.status === "inactive") {
    return NextResponse.json({ error: "Account non attivo" }, { status: 403 });
  }
  if (outcome.status === "no_assistenza") {
    return NextResponse.json(
      { error: "Permesso assistenza revocato" },
      { status: 403 },
    );
  }

  return NextResponse.json({ error: "Utente non trovato" }, { status: 404 });
}
