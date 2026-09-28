import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { countUnreadAnnouncementsForUser } from "@/lib/avvisi/credixaAnnouncements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }
  if (user.role !== "ADMIN") {
    return NextResponse.json({ count: 0 });
  }
  try {
    const count = await countUnreadAnnouncementsForUser(user.tenantId, user.id);
    return NextResponse.json({ count });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Errore conteggio avvisi";
    return NextResponse.json({ error: msg, count: 0 }, { status: 500 });
  }
}
