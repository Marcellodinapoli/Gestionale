import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/guard";
import { canAccessPratica } from "@/lib/domain";
import {
  acquirePraticaLock,
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
  try {
    // renew riacquisisce se il lock è scaduto; se fallisce (corsa), prova acquire esplicito
    let lock = await renewPraticaLock(id, user.id, scope);
    if (!lock.owned && !lock.lockedBy) {
      lock = await acquirePraticaLock(id, user.id, scope);
    }
    return NextResponse.json({
      owned: lock.owned,
      lockedByName: lock.lockedBy?.name ?? null,
    });
  } catch (err) {
    console.error("[pratiche/lock POST]", err);
    // Evita 500 opachi in UI/timeline: stato lock ancora recuperabile in GET.
    const lock = await getPraticaLockStatus(id, user.id, scope).catch(() => null);
    if (lock) {
      return NextResponse.json({
        owned: lock.owned,
        lockedByName: lock.lockedBy?.name ?? null,
      });
    }
    return NextResponse.json({ error: "Lock non disponibile" }, { status: 503 });
  }
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
