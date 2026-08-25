import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isUserPasswordExpired } from "@/lib/passwordPolicy";
import { assertCan, can, isManutenzione, type Permission, type SessionUser } from "@/lib/permissions";
import { redirect } from "next/navigation";

type RequireUserOptions = {
  /** Consente l'accesso solo per cambio password obbligatorio o logout. */
  allowExpiredPassword?: boolean;
};

async function assertPasswordFresh(
  userId: string,
  allowExpiredPassword?: boolean
) {
  if (allowExpiredPassword) return;
  if (await isUserPasswordExpired(userId)) {
    redirect("/cambia-password");
  }
}

export async function requireUser(options?: RequireUserOptions) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  await assertPasswordFresh(user.id, options?.allowExpiredPassword);
  return user;
}

/** Autenticazione API: blocca sessioni con password scaduta (403). */
export async function requireApiUser(): Promise<SessionUser | NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }
  if (await isUserPasswordExpired(user.id)) {
    return NextResponse.json(
      { error: "Password scaduta: aggiornala per continuare" },
      { status: 403 }
    );
  }
  return user;
}

export async function requirePermission(permission: Permission) {
  const user = await requireUser();
  if (!can(user, permission)) {
    redirect("/");
  }
  return user;
}

function assertWritable(user: Awaited<ReturnType<typeof requireUser>>) {
  if (isManutenzione(user)) {
    throw new Error(
      "Account manutenzione: sola consultazione della struttura, senza dati operativi"
    );
  }
}

export async function requireWritableUser() {
  const user = await requireUser();
  assertWritable(user);
  return user;
}

export async function requireWritablePermission(permission: Permission) {
  const user = await requirePermission(permission);
  assertWritable(user);
  return user;
}

export { assertCan };
