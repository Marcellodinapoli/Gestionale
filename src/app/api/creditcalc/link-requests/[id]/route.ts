import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/guard";
import { can } from "@/lib/permissions";
import {
  getLinkRequest,
  refreshLinkRequestStatus,
  revokeLinkRequest,
} from "@/lib/creditcalc/store";

export const dynamic = "force-dynamic";

/** Stato LinkRequest (poll UI gestionale). */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;

  const { id } = await ctx.params;
  let link = await getLinkRequest(id);
  if (!link) {
    return NextResponse.json({ error: "Richiesta non trovata" }, { status: 404 });
  }
  if (link.tenantId !== user.tenantId) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  }
  if (
    link.gestionaleUserId !== user.id &&
    link.createdByUserId !== user.id &&
    !can(user, "operatori:manage")
  ) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  }

  link = await refreshLinkRequestStatus(link);
  return NextResponse.json({
    linkRequestId: link.linkRequestId,
    status: link.status,
    expiresAt: link.expiresAt,
    createdAt: link.createdAt,
    operatorName: link.operatorName,
    tenantName: link.tenantName,
    consumedAt: link.consumedAt ?? null,
  });
}

/** Revoca QR pending. */
export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;

  const { id } = await ctx.params;
  const link = await getLinkRequest(id);
  if (!link) {
    return NextResponse.json({ error: "Richiesta non trovata" }, { status: 404 });
  }
  if (link.tenantId !== user.tenantId) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  }
  if (
    link.gestionaleUserId !== user.id &&
    link.createdByUserId !== user.id &&
    !can(user, "operatori:manage")
  ) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  }

  const updated = await revokeLinkRequest(id);
  return NextResponse.json({
    linkRequestId: updated?.linkRequestId,
    status: updated?.status,
  });
}
