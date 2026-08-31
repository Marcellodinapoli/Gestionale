import "server-only";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { isConnectorProvider } from "@/lib/data/factory";
import { usersDb } from "@/lib/usersRepo";
import { connectorFetch } from "@/lib/data/connector/ConnectorClient";
import { validatePasswordComplexity } from "@/lib/passwordRules";

export { PASSWORD_MIN_LENGTH } from "@/lib/passwordRules";
export const PASSWORD_MAX_AGE_DAYS = 30;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

type DateLike = Date | string | null | undefined;

function toDate(value: DateLike): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function isPasswordExpired(passwordChangedAt: DateLike) {
  const changedAt = toDate(passwordChangedAt);
  if (!changedAt) return true;
  return Date.now() - changedAt.getTime() >= PASSWORD_MAX_AGE_DAYS * MS_PER_DAY;
}

export function giorniAllaScadenzaPassword(passwordChangedAt: DateLike) {
  const changedAt = toDate(passwordChangedAt);
  if (!changedAt) return 0;
  const expiresAt = changedAt.getTime() + PASSWORD_MAX_AGE_DAYS * MS_PER_DAY;
  return Math.max(0, Math.ceil((expiresAt - Date.now()) / MS_PER_DAY));
}

async function userModelForPasswordOps(userId: string) {
  if (!isConnectorProvider()) return prisma.user;
  const { getCurrentUser } = await import("@/lib/auth");
  const current = await getCurrentUser();
  if (!current?.tenantId) return prisma.user;
  return usersDb({
    tenantId: current.tenantId,
    tenantSlug: current.tenantSlug ?? current.tenantId,
  });
}

export async function isUserPasswordExpired(userId: string) {
  try {
    const { getCurrentUser, isCurrentUserPasswordExpired } = await import("@/lib/auth");
    const current = await getCurrentUser();
    if (current?.id === userId) return isCurrentUserPasswordExpired();
  } catch {
    /* ignore */
  }
  const userModel = await userModelForPasswordOps(userId);
  const user = await userModel.findUnique({
    where: { id: userId },
    select: { passwordChangedAt: true },
  });
  return isPasswordExpired(user?.passwordChangedAt);
}

async function loadPasswordReuseContext(userId: string) {
  if (!isConnectorProvider()) {
    return prisma.user.findUnique({
      where: { id: userId },
      select: {
        passwordHash: true,
        passwordHistory: { select: { passwordHash: true } },
      },
    });
  }
  const data = await connectorFetch<{
    context: { passwordHash: string; passwordHistory: Array<{ passwordHash: string }> };
  }>(`/api/v1/internal/users/${encodeURIComponent(userId)}/password-context`);
  return {
    passwordHash: data.context.passwordHash,
    passwordHistory: data.context.passwordHistory,
  };
}

export async function assertPasswordNotReused(userId: string, newPassword: string) {
  const user = await loadPasswordReuseContext(userId);
  if (!user) throw new Error("Utente non trovato");

  if (await bcrypt.compare(newPassword, user.passwordHash)) {
    throw new Error("Non puoi riusare una password già utilizzata");
  }

  const history = Array.isArray(user.passwordHistory) ? user.passwordHistory : [];
  for (const row of history) {
    if (await bcrypt.compare(newPassword, row.passwordHash)) {
      throw new Error("Non puoi riusare una password già utilizzata");
    }
  }
}

/** Archivia la password corrente e imposta quella nuova (mai riusata). */
export async function rotateUserPassword(userId: string, newPassword: string) {
  const complexityErr = validatePasswordComplexity(newPassword);
  if (complexityErr) throw new Error(complexityErr);

  await assertPasswordNotReused(userId, newPassword);

  const userModel = await userModelForPasswordOps(userId);
  const user = await userModel.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  });
  if (!user) throw new Error("Utente non trovato");

  const passwordHash = await bcrypt.hash(newPassword, 10);
  const now = new Date();

  if (isConnectorProvider()) {
    await connectorFetch(`/api/v1/internal/users/${encodeURIComponent(userId)}/password-history`, {
      method: "POST",
      body: { passwordHash: user.passwordHash },
    });
    await connectorFetch(`/api/v1/internal/users/${encodeURIComponent(userId)}/password`, {
      method: "PATCH",
      body: { passwordHash, passwordChangedAt: now.toISOString() },
    });
    return;
  }

  await prisma.$transaction([
    prisma.passwordHistory.create({
      data: { userId, passwordHash: user.passwordHash },
    }),
    prisma.user.update({
      where: { id: userId },
      data: { passwordHash, passwordChangedAt: now },
    }),
  ]);
}
