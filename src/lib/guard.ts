import { getCurrentUser } from "@/lib/auth";
import { assertCan, can, isManutenzione, type Permission } from "@/lib/permissions";
import { redirect } from "next/navigation";

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
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
