import { prisma } from "@/lib/prisma";
import type { LockRepository } from "@/lib/data/contracts/lock";
import { PRATICA_LOCK_TTL_MS } from "@/lib/data/contracts/lock";

function lockExpired(lastHeartbeatAt: Date) {
  return Date.now() - lastHeartbeatAt.getTime() > PRATICA_LOCK_TTL_MS;
}

async function purgeExpiredForPratica(praticaId: string) {
  const cutoff = new Date(Date.now() - PRATICA_LOCK_TTL_MS);
  await prisma.praticaLock.deleteMany({
    where: { praticaId, lastHeartbeatAt: { lt: cutoff } },
  });
}

async function purgeExpiredGlobal() {
  const cutoff = new Date(Date.now() - PRATICA_LOCK_TTL_MS);
  await prisma.praticaLock.deleteMany({
    where: { lastHeartbeatAt: { lt: cutoff } },
  });
}

export const firestoreLockRepository: LockRepository = {
  async acquire(praticaId, userId) {
    return prisma.$transaction(async (tx) => {
      const cutoff = new Date(Date.now() - PRATICA_LOCK_TTL_MS);
      await tx.praticaLock.deleteMany({
        where: { praticaId, lastHeartbeatAt: { lt: cutoff } },
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
  },

  async getStatus(praticaId, userId) {
    await purgeExpiredForPratica(praticaId);

    const existing = await prisma.praticaLock.findUnique({
      where: { praticaId },
      include: { user: { select: { id: true, name: true } } },
    });

    if (!existing) return { owned: false, lockedBy: null };
    if (existing.userId === userId) return { owned: true, lockedBy: null };
    return {
      owned: false,
      lockedBy: { id: existing.user.id, name: existing.user.name },
    };
  },

  async renew(praticaId, userId) {
    const existing = await prisma.praticaLock.findUnique({
      where: { praticaId },
      include: { user: { select: { id: true, name: true } } },
    });

    if (!existing || lockExpired(existing.lastHeartbeatAt)) {
      return firestoreLockRepository.acquire(praticaId, userId);
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
  },

  async release(praticaId, userId) {
    await prisma.praticaLock.deleteMany({ where: { praticaId, userId } });
  },

  async releaseAllForUser(userId) {
    await prisma.praticaLock.deleteMany({ where: { userId } });
  },

  async releaseForPratica(praticaId) {
    await prisma.praticaLock.deleteMany({ where: { praticaId } });
  },

  async findActiveByPraticaIds(praticaIds) {
    if (!praticaIds.length) return [];
    await purgeExpiredGlobal();
    const locks = await prisma.praticaLock.findMany({
      where: { praticaId: { in: praticaIds } },
      include: { user: { select: { id: true, name: true } } },
    });
    return locks
      .filter((l) => !lockExpired(l.lastHeartbeatAt))
      .map((l) => ({
        praticaId: l.praticaId,
        userId: l.userId,
        userName: l.user.name,
      }));
  },
};

export { lockExpired, purgeExpiredForPratica };
