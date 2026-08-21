import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { canAccessPratica } from "@/lib/domain";
import {
  getPraticaLockStatus,
  releasePraticaLock,
  renewPraticaLock,
} from "@/lib/praticaLock";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: RouteCtx) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  const { id } = await ctx.params;
  if (!(await canAccessPratica(user, id))) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  }

  const lock = await getPraticaLockStatus(id, user.id);
  return NextResponse.json({
    owned: lock.owned,
    lockedByName: lock.lockedBy?.name ?? null,
  });
}

export async function POST(_req: Request, ctx: RouteCtx) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  const { id } = await ctx.params;
  if (!(await canAccessPratica(user, id))) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  }

  const lock = await renewPraticaLock(id, user.id);
  return NextResponse.json({
    owned: lock.owned,
    lockedByName: lock.lockedBy?.name ?? null,
  });
}

export async function DELETE(_req: Request, ctx: RouteCtx) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  const { id } = await ctx.params;
  if (!(await canAccessPratica(user, id))) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  }

  await releasePraticaLock(id, user.id);
  return NextResponse.json({ ok: true });
}
