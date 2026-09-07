import "server-only";
import type { CreditCalcConnection } from "./types";
import {
  acquirePraticaLock,
  getPraticaLockStatus,
  releasePraticaLock,
  renewPraticaLock,
} from "@/lib/praticaLock";
import type { LockTenantScope, PraticaLockStatus } from "@/lib/data/contracts/lock";

export type CreditCalcLockView = {
  canWork: boolean;
  lockedByName: string | null;
};

function scopeFromConnection(connection: CreditCalcConnection): LockTenantScope {
  return {
    tenantId: connection.tenantId,
    tenantSlug: connection.tenantSlug || connection.tenantId,
  };
}

export async function creditCalcTryAcquireLock(
  connection: CreditCalcConnection,
  praticaId: string
): Promise<CreditCalcLockView> {
  const scope = scopeFromConnection(connection);
  const userId = connection.gestionaleUserId;
  const status = await getPraticaLockStatus(praticaId, userId, scope);

  if (status.lockedBy) {
    return { canWork: false, lockedByName: status.lockedBy.name };
  }
  if (status.owned) {
    await renewPraticaLock(praticaId, userId, scope);
    return { canWork: true, lockedByName: null };
  }

  const acquired = await acquirePraticaLock(praticaId, userId, scope);
  return {
    canWork: acquired.owned,
    lockedByName: acquired.lockedBy?.name ?? null,
  };
}

export async function creditCalcAssertLockHeld(
  connection: CreditCalcConnection,
  praticaId: string
): Promise<void> {
  const scope = scopeFromConnection(connection);
  const userId = connection.gestionaleUserId;
  const existing = await getPraticaLockStatus(praticaId, userId, scope);

  if (existing.owned) {
    await renewPraticaLock(praticaId, userId, scope);
    return;
  }
  if (existing.lockedBy) {
    const err = new Error(`Pratica in uso da ${existing.lockedBy.name}`);
    (err as Error & { status: number }).status = 409;
    throw err;
  }

  const acquired = await acquirePraticaLock(praticaId, userId, scope);
  if (!acquired.owned) {
    const name = acquired.lockedBy?.name ?? "un altro operatore";
    const err = new Error(`Pratica in uso da ${name}`);
    (err as Error & { status: number }).status = 409;
    throw err;
  }
}

export async function creditCalcRenewLock(
  connection: CreditCalcConnection,
  praticaId: string
): Promise<CreditCalcLockView> {
  const scope = scopeFromConnection(connection);
  let lock: PraticaLockStatus = await renewPraticaLock(
    praticaId,
    connection.gestionaleUserId,
    scope
  );
  if (!lock.owned && !lock.lockedBy) {
    lock = await acquirePraticaLock(
      praticaId,
      connection.gestionaleUserId,
      scope
    );
  }
  return {
    canWork: lock.owned,
    lockedByName: lock.lockedBy?.name ?? null,
  };
}

export async function creditCalcReleaseLock(
  connection: CreditCalcConnection,
  praticaId: string
): Promise<void> {
  const scope = scopeFromConnection(connection);
  await releasePraticaLock(praticaId, connection.gestionaleUserId, scope);
}
