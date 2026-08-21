import { prisma } from "@/lib/prisma";

export const PRATICA_LOCK_TTL_MS = 45_000;

export type PraticaLockStatus = {
  owned: boolean;
  lockedBy: { id: string; name: string } | null;
};

export type PraticaWorkContext = {
  canWork: boolean;
  lockedByName: string | null;
};

function lockExpired(lastHeartbeatAt: Date) {
  return Date.now() - lastHeartbeatAt.getTime() > PRATICA_LOCK_TTL_MS;
}

async function purgeExpiredLocks() {
  const cutoff = new Date(Date.now() - PRATICA_LOCK_TTL_MS);
  await prisma.praticaLock.deleteMany({
    where: { lastHeartbeatAt: { lt: cutoff } },
  });
}

export async function acquirePraticaLock(
  praticaId: string,
  userId: string
): Promise<PraticaLockStatus> {
  return prisma.$transaction(async (tx) => {
    const cutoff = new Date(Date.now() - PRATICA_LOCK_TTL_MS);
    await tx.praticaLock.deleteMany({
      where: { lastHeartbeatAt: { lt: cutoff } },
    });

    const existing = await tx.praticaLock.findUnique({
      where: { praticaId },
      include: { user: { select: { id: true, name: true } } },
    });

    const now = new Date();

    if (!existing) {
      await tx.praticaLock.create({
        data: { praticaId, userId, lastHeartbeatAt: now },
      });
      return { owned: true, lockedBy: null };
    }

    if (existing.userId === userId || lockExpired(existing.lastHeartbeatAt)) {
      await tx.praticaLock.update({
        where: { praticaId },
        data: { userId, lastHeartbeatAt: now },
      });
      return { owned: true, lockedBy: null };
    }

    return {
      owned: false,
      lockedBy: { id: existing.user.id, name: existing.user.name },
    };
  });
}

export async function getPraticaLockStatus(
  praticaId: string,
  userId: string
): Promise<PraticaLockStatus> {
  await purgeExpiredLocks();

  const existing = await prisma.praticaLock.findUnique({
    where: { praticaId },
    include: { user: { select: { id: true, name: true } } },
  });

  if (!existing) {
    return { owned: false, lockedBy: null };
  }

  if (existing.userId === userId) {
    return { owned: true, lockedBy: null };
  }

  return {
    owned: false,
    lockedBy: { id: existing.user.id, name: existing.user.name },
  };
}

export async function renewPraticaLock(praticaId: string, userId: string): Promise<PraticaLockStatus> {
  const existing = await prisma.praticaLock.findUnique({
    where: { praticaId },
    include: { user: { select: { id: true, name: true } } },
  });

  if (!existing || lockExpired(existing.lastHeartbeatAt)) {
    return acquirePraticaLock(praticaId, userId);
  }

  if (existing.userId !== userId) {
    return {
      owned: false,
      lockedBy: { id: existing.user.id, name: existing.user.name },
    };
  }

  await prisma.praticaLock.update({
    where: { praticaId },
    data: { lastHeartbeatAt: new Date() },
  });

  return { owned: true, lockedBy: null };
}

export async function releasePraticaLock(praticaId: string, userId: string) {
  await prisma.praticaLock.deleteMany({
    where: { praticaId, userId },
  });
}

export async function releaseAllUserLocks(userId: string) {
  await prisma.praticaLock.deleteMany({ where: { userId } });
}

export async function getPraticaWorkContext(
  userId: string,
  praticaId: string
): Promise<PraticaWorkContext> {
  const status = await getPraticaLockStatus(praticaId, userId);

  if (status.lockedBy) {
    return { canWork: false, lockedByName: status.lockedBy.name };
  }

  if (status.owned) {
    await renewPraticaLock(praticaId, userId);
    return { canWork: true, lockedByName: null };
  }

  const acquired = await acquirePraticaLock(praticaId, userId);
  return {
    canWork: acquired.owned,
    lockedByName: acquired.lockedBy?.name ?? null,
  };
}

export async function assertPraticaNotLockedByOther(userId: string, praticaId: string) {
  await purgeExpiredLocks();

  const existing = await prisma.praticaLock.findUnique({
    where: { praticaId },
    include: { user: { select: { id: true, name: true } } },
  });

  if (
    existing &&
    !lockExpired(existing.lastHeartbeatAt) &&
    existing.userId !== userId
  ) {
    throw new Error(`Pratica in uso da ${existing.user.name}`);
  }
}

export async function assertPraticaLockHeld(userId: string, praticaId: string) {
  await purgeExpiredLocks();

  const existing = await prisma.praticaLock.findUnique({
    where: { praticaId },
    include: { user: { select: { id: true, name: true } } },
  });

  if (!existing || lockExpired(existing.lastHeartbeatAt) || existing.userId !== userId) {
    const name = existing?.user.name ?? "un altro operatore";
    throw new Error(`Pratica in uso da ${name}`);
  }

  await prisma.praticaLock.update({
    where: { praticaId },
    data: { lastHeartbeatAt: new Date() },
  });
}
