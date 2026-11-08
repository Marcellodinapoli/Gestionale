import { requireApiUser } from "@/lib/guard";
import { can } from "@/lib/permissions";
import { usersDbFromUser } from "@/lib/usersRepo";
import { findTenantById } from "@/lib/data/operationalAccess";
import { resolveCreditcalcBffPublicUrl } from "@/lib/creditcalc/bffPublicUrl";
import { createLinkRequest } from "@/lib/creditcalc/store";
import { assertTenantCreditCalcModule } from "@/lib/creditcalc/tenantAccess";
import { isFirebaseAvailable } from "@/lib/formazione/firebaseGuard";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Crea LinkRequest + payload QR (solo linkRequestId). Sessione gestionale. */
export async function POST(req: Request) {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;

  let body: { gestionaleUserId?: string } = {};
  try {
    body = (await req.json()) as { gestionaleUserId?: string };
  } catch {
    body = {};
  }

  const targetId = String(body.gestionaleUserId || user.id).trim() || user.id;
  const users = usersDbFromUser(user);

  if (targetId !== user.id && !can(user, "operatori:manage")) {
    return NextResponse.json(
      { error: "Non puoi generare QR per altri operatori" },
      { status: 403 }
    );
  }

  const target = await users.findUnique({
    where: { id: targetId },
    select: {
      id: true,
      tenantId: true,
      name: true,
      email: true,
      active: true,
      consulenteEsterno: true,
      creditCalcEnabled: true,
    },
  });

  if (!target || target.tenantId !== user.tenantId || !target.active) {
    return NextResponse.json({ error: "Operatore non valido" }, { status: 404 });
  }
  if (!target.consulenteEsterno || !target.creditCalcEnabled) {
    return NextResponse.json(
      {
        error:
          "L’operatore deve essere consulente esterno con CredixaApp abilitato",
      },
      { status: 403 }
    );
  }

  const moduleOk = await assertTenantCreditCalcModule(user.tenantId);
  if (!moduleOk.ok) {
    return NextResponse.json(
      { error: moduleOk.error },
      { status: moduleOk.status }
    );
  }

  const tenant = await findTenantById(user.tenantId);
  if (!tenant) {
    return NextResponse.json({ error: "Tenant non trovato" }, { status: 404 });
  }

  if (!isFirebaseAvailable()) {
    return NextResponse.json(
      {
        error:
          "Il collegamento QR non è attivo su questo server. Contatta l'amministratore di sistema.",
      },
      { status: 503 }
    );
  }

  try {
    const link = await createLinkRequest({
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      tenantName: tenant.nome,
      gestionaleUserId: target.id,
      operatorName: target.name,
      operatorEmail: target.email,
      createdByUserId: user.id,
    });

    const bffBaseUrl = resolveCreditcalcBffPublicUrl(req);
    return NextResponse.json({
      linkRequestId: link.linkRequestId,
      bffBaseUrl,
      /** URL pubblico BFF + UUID (l’app ricava host e id; compatibile anche UUID grezzo legacy). */
      qrPayload: `${bffBaseUrl}/creditcalc/pair/${link.linkRequestId}`,
      expiresAt: link.expiresAt,
      status: link.status,
      operatorName: link.operatorName,
      tenantName: link.tenantName,
    });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Errore durante la generazione del QR";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
