import { requireApiUser } from "@/lib/guard";
import {
  listConnectionsForGestionaleUser,
  revokeConnectionForGestionaleUser,
} from "@/lib/creditcalc/store";
import { isFirebaseAvailable } from "@/lib/formazione/firebaseGuard";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Stato collegamento CredixaApp per l’operatore in sessione (Account). */
export async function GET() {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;

  if (!isFirebaseAvailable()) {
    return NextResponse.json({
      linked: false,
      connections: [],
      firebase: false,
    });
  }

  const all = await listConnectionsForGestionaleUser(user.id);
  const connections = all.filter((c) => c.tenantId === user.tenantId);
  return NextResponse.json({
    linked: connections.length > 0,
    connections: connections.map((c) => ({
      connectionId: c.connectionId,
      tenantName: c.tenantName,
      createdAt: c.createdAt,
    })),
    firebase: true,
  });
}

/** Scollega CredixaApp dall’operatore in sessione (Account). */
export async function DELETE(req: Request) {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;

  if (!isFirebaseAvailable()) {
    return NextResponse.json(
      { error: "Collegamenti QR non disponibili su questo server" },
      { status: 503 }
    );
  }

  let body: { connectionId?: string } = {};
  try {
    const text = await req.text();
    if (text.trim()) body = JSON.parse(text) as { connectionId?: string };
  } catch {
    return NextResponse.json({ error: "Body non valido" }, { status: 400 });
  }

  const active = (await listConnectionsForGestionaleUser(user.id)).filter(
    (c) => c.tenantId === user.tenantId && c.status === "active"
  );
  if (active.length === 0) {
    return NextResponse.json({ error: "Nessun collegamento attivo" }, { status: 404 });
  }

  const targetId = String(body.connectionId || "").trim();
  const toRevoke = targetId
    ? active.filter((c) => c.connectionId === targetId)
    : active;
  if (targetId && toRevoke.length === 0) {
    return NextResponse.json({ error: "Collegamento non trovato" }, { status: 404 });
  }

  const revoked: string[] = [];
  for (const c of toRevoke) {
    const result = await revokeConnectionForGestionaleUser(
      user.id,
      user.tenantId,
      c.connectionId
    );
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status }
      );
    }
    revoked.push(c.connectionId);
  }

  return NextResponse.json({
    ok: true,
    revoked,
    linked: false,
  });
}
