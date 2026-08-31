import "server-only";
import type { SessionUser } from "@/lib/permissions";
import type {
  LockRepository,
  LockTenantScope,
  PraticaLockStatus,
} from "@/lib/data/contracts/lock";
import {
  PRATICA_LOCK_TTL_MS,
  PRATICA_LOCK_HEARTBEAT_MS,
} from "@/lib/data/contracts/lock";
import { isConnectorProvider } from "@/lib/data/factory";
import { createConnectorLockRepository } from "@/lib/data/connector/ConnectorLockRepository";
import { firestoreLockRepository } from "@/lib/praticaLockFirestore";

export { PRATICA_LOCK_TTL_MS, PRATICA_LOCK_HEARTBEAT_MS };
export type { PraticaLockStatus };

export type PraticaWorkContext = {
  canWork: boolean;
  lockedByName: string | null;
};

export function lockScopeFromUser(user: {
  tenantId: string;
  tenantSlug?: string | null;
}): LockTenantScope {
  return {
    tenantId: user.tenantId,
    tenantSlug: user.tenantSlug ?? user.tenantId,
  };
}

function lockRepo(scope?: LockTenantScope): LockRepository {
  if (isConnectorProvider()) {
    if (!scope) throw new Error("Lock tenant scope richiesto con DATABASE_PROVIDER=connector");
    return createConnectorLockRepository(scope);
  }
  return firestoreLockRepository;
}

export async function acquirePraticaLock(
  praticaId: string,
  userId: string,
  scope?: LockTenantScope
): Promise<PraticaLockStatus> {
  return lockRepo(scope).acquire(praticaId, userId);
}

export async function getPraticaLockStatus(
  praticaId: string,
  userId: string,
  scope?: LockTenantScope
): Promise<PraticaLockStatus> {
  return lockRepo(scope).getStatus(praticaId, userId);
}

export async function renewPraticaLock(
  praticaId: string,
  userId: string,
  scope?: LockTenantScope
): Promise<PraticaLockStatus> {
  return lockRepo(scope).renew(praticaId, userId);
}

export async function releasePraticaLock(
  praticaId: string,
  userId: string,
  scope?: LockTenantScope
) {
  await lockRepo(scope).release(praticaId, userId);
}

export async function releaseAllUserLocks(userId: string, scope?: LockTenantScope) {
  await lockRepo(scope).releaseAllForUser(userId);
}

export async function releasePraticaLockForImport(praticaId: string, scope?: LockTenantScope) {
  await lockRepo(scope).releaseForPratica(praticaId);
}

export async function findActivePraticaLocks(praticaIds: string[], scope?: LockTenantScope) {
  return lockRepo(scope).findActiveByPraticaIds(praticaIds);
}

export async function getPraticaWorkContext(
  user: SessionUser,
  praticaId: string
): Promise<PraticaWorkContext> {
  const scope = lockScopeFromUser(user);
  const status = await getPraticaLockStatus(praticaId, user.id, scope);

  if (status.lockedBy) {
    return { canWork: false, lockedByName: status.lockedBy.name };
  }

  if (status.owned) {
    await renewPraticaLock(praticaId, user.id, scope);
    return { canWork: true, lockedByName: null };
  }

  const acquired = await acquirePraticaLock(praticaId, user.id, scope);
  return {
    canWork: acquired.owned,
    lockedByName: acquired.lockedBy?.name ?? null,
  };
}

export async function assertPraticaNotLockedByOther(
  user: SessionUser,
  praticaId: string
) {
  const scope = lockScopeFromUser(user);
  const existing = await getPraticaLockStatus(praticaId, user.id, scope);

  if (!existing.owned && existing.lockedBy) {
    throw new Error(`Pratica in uso da ${existing.lockedBy.name}`);
  }
}

export async function assertPraticaLockHeld(user: SessionUser, praticaId: string) {
  const scope = lockScopeFromUser(user);
  const existing = await getPraticaLockStatus(praticaId, user.id, scope);

  if (!existing.owned) {
    const name = existing.lockedBy?.name ?? "un altro operatore";
    throw new Error(`Pratica in uso da ${name}`);
  }

  await renewPraticaLock(praticaId, user.id, scope);
}
