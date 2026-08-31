export const PRATICA_LOCK_TTL_MS = 45_000;
export const PRATICA_LOCK_HEARTBEAT_MS = 30_000;

export type PraticaLockHolder = {
  id: string;
  name: string;
};

export type PraticaLockStatus = {
  owned: boolean;
  lockedBy: PraticaLockHolder | null;
};

export type LockTenantScope = {
  tenantId: string;
  tenantSlug: string;
};

export interface LockRepository {
  acquire(praticaId: string, userId: string): Promise<PraticaLockStatus>;
  renew(praticaId: string, userId: string): Promise<PraticaLockStatus>;
  release(praticaId: string, userId: string): Promise<void>;
  getStatus(praticaId: string, userId: string): Promise<PraticaLockStatus>;
  releaseAllForUser(userId: string): Promise<void>;
  releaseForPratica(praticaId: string): Promise<void>;
  findActiveByPraticaIds(praticaIds: string[]): Promise<
    Array<{ praticaId: string; userId: string; userName: string }>
  >;
}
