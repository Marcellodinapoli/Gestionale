import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/guard";
import { canAccessPratica } from "@/lib/domain";
import {
  getPraticaLockStatus,
  releasePraticaLock,
  renewPraticaLock,
  lockScopeFromUser,
} from "@/lib/praticaLock";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: RouteCtx) {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;

  const { id } = await ctx.params;
  if (!(await canAccessPratica(user, id))) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  }

  const scope = lockScopeFromUser(user);
  const lock = await getPraticaLockStatus(id, user.id, scope);
  return NextResponse.json({
    owned: lock.owned,
    lockedByName: lock.lockedBy?.name ?? null,
  });
}

export async function POST(_req: Request, ctx: RouteCtx) {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;

  const { id } = await ctx.params;
  if (!(await canAccessPratica(user, id))) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  }

  const scope = lockScopeFromUser(user);
  const lock = await renewPraticaLock(id, user.id, scope);
  return NextResponse.json({
    owned: lock.owned,
    lockedByName: lock.lockedBy?.name ?? null,
  });
}

export async function DELETE(_req: Request, ctx: RouteCtx) {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;

  const { id } = await ctx.params;
  if (!(await canAccessPratica(user, id))) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  }

  const scope = lockScopeFromUser(user);
  await releasePraticaLock(id, user.id, scope);
  return NextResponse.json({ ok: true });
}
