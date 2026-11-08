import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/guard";
import { canReceiveInboundScreenPop } from "@/lib/permissions";
import { lookupPraticheInboundCall } from "@/lib/telephony/inboundLookup";

export async function GET(req: Request) {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;
  if (!canReceiveInboundScreenPop(user.role)) {
    return NextResponse.json({ error: "Operazione non consentita per il tuo ruolo" }, { status: 403 });
  }

  const url = new URL(req.url);
  const numero = url.searchParams.get("numero")?.trim() || "";
  if (!numero) {
    return NextResponse.json({ error: "Parametro numero obbligatorio" }, { status: 400 });
  }

  const numeroChiamato = url.searchParams.get("numeroChiamato")?.trim() || undefined;
  const result = await lookupPraticheInboundCall(user, numero, { numeroChiamato });
  return NextResponse.json(result);
}
