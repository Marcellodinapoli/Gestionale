import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const PASSWORD_MAX_AGE_DAYS = 30;
export const PASSWORD_MIN_LENGTH = 6;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function isPasswordExpired(passwordChangedAt: Date | null | undefined) {
  if (!passwordChangedAt) return true;
  return Date.now() - passwordChangedAt.getTime() >= PASSWORD_MAX_AGE_DAYS * MS_PER_DAY;
}

export function giorniAllaScadenzaPassword(passwordChangedAt: Date | null | undefined) {
  if (!passwordChangedAt) return 0;
  const expiresAt = passwordChangedAt.getTime() + PASSWORD_MAX_AGE_DAYS * MS_PER_DAY;
  return Math.max(0, Math.ceil((expiresAt - Date.now()) / MS_PER_DAY));
}

export async function isUserPasswordExpired(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordChangedAt: true },
  });
  return isPasswordExpired(user?.passwordChangedAt);
}

export async function assertPasswordNotReused(userId: string, newPassword: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      passwordHash: true,
      passwordHistory: { select: { passwordHash: true } },
    },
  });
  if (!user) throw new Error("Utente non trovato");

  if (await bcrypt.compare(newPassword, user.passwordHash)) {
    throw new Error("Non puoi riusare una password già utilizzata");
  }

  for (const row of user.passwordHistory) {
    if (await bcrypt.compare(newPassword, row.passwordHash)) {
      throw new Error("Non puoi riusare una password già utilizzata");
    }
  }
}

/** Archivia la password corrente e imposta quella nuova (mai riusata). */
export async function rotateUserPassword(userId: string, newPassword: string) {
  if (newPassword.length < PASSWORD_MIN_LENGTH) {
    throw new Error(`La password deve avere almeno ${PASSWORD_MIN_LENGTH} caratteri`);
  }

  await assertPasswordNotReused(userId, newPassword);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  });
  if (!user) throw new Error("Utente non trovato");

  const passwordHash = await bcrypt.hash(newPassword, 10);
  const now = new Date();

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
