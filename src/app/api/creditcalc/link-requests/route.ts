import { requireApiUser } from "@/lib/guard";
import { can } from "@/lib/permissions";
import { usersDbFromUser } from "@/lib/usersRepo";
import { findTenantById } from "@/lib/data/operationalAccess";
import { createLinkRequest } from "@/lib/creditcalc/store";
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
          "L’operatore deve essere consulente esterno con CreditCalc abilitato",
      },
      { status: 403 }
    );
  }

  const tenant = await findTenantById(user.tenantId);
  if (!tenant) {
    return NextResponse.json({ error: "Tenant non trovato" }, { status: 404 });
  }

  const link = await createLinkRequest({
    tenantId: tenant.id,
    tenantSlug: tenant.slug,
    tenantName: tenant.nome,
    gestionaleUserId: target.id,
    operatorName: target.name,
    operatorEmail: target.email,
    createdByUserId: user.id,
  });

  return NextResponse.json({
    linkRequestId: link.linkRequestId,
    /** Unico contenuto del QR — nessun secret. */
    qrPayload: link.linkRequestId,
    expiresAt: link.expiresAt,
    status: link.status,
    operatorName: link.operatorName,
    tenantName: link.tenantName,
  });
}
