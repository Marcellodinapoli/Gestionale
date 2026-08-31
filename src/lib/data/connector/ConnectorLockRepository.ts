import "server-only";

import { connectorFetch } from "@/lib/data/connector/ConnectorClient";

import type {

  LockRepository,

  LockTenantScope,

  PraticaLockStatus,

} from "@/lib/data/contracts/lock";



type LockApiStatus = {

  owned: boolean;

  lockedByName?: string | null;

  lockedBy?: { id: string; name: string } | null;

};



function mapStatus(data: LockApiStatus): PraticaLockStatus {

  if (data.owned) return { owned: true, lockedBy: null };

  if (data.lockedBy) return { owned: false, lockedBy: data.lockedBy };

  if (data.lockedByName) {

    return { owned: false, lockedBy: { id: "", name: data.lockedByName } };

  }

  return { owned: false, lockedBy: null };

}



export class ConnectorLockRepository implements LockRepository {

  constructor(

    private tenantSlug: string,

    private scope: LockTenantScope

  ) {}



  private base(praticaId: string) {

    return `/api/v1/tenants/${encodeURIComponent(this.tenantSlug)}/pratiche/${encodeURIComponent(praticaId)}`;

  }



  async acquire(praticaId: string, userId: string): Promise<PraticaLockStatus> {

    const data = await connectorFetch<LockApiStatus>(`${this.base(praticaId)}/lock/acquire`, {

      method: "POST",

      body: { userId },

    });

    return mapStatus(data);

  }



  async renew(praticaId: string, userId: string): Promise<PraticaLockStatus> {

    const data = await connectorFetch<LockApiStatus>(`${this.base(praticaId)}/lock`, {

      method: "POST",

      body: { userId },

    });

    return mapStatus(data);

  }



  async release(praticaId: string, userId: string): Promise<void> {

    await connectorFetch(`${this.base(praticaId)}/lock`, {

      method: "DELETE",

      body: { userId },

    });

  }



  async getStatus(praticaId: string, userId: string): Promise<PraticaLockStatus> {

    const data = await connectorFetch<LockApiStatus>(

      `${this.base(praticaId)}/lock?userId=${encodeURIComponent(userId)}`

    );

    return mapStatus(data);

  }



  async releaseAllForUser(userId: string): Promise<void> {

    await connectorFetch(

      `/api/v1/tenants/${encodeURIComponent(this.tenantSlug)}/pratiche/locks/user`,

      { method: "DELETE", body: { userId } }

    );

  }



  async releaseForPratica(praticaId: string): Promise<void> {

    await connectorFetch(`${this.base(praticaId)}/lock/pratica`, { method: "DELETE" });

  }



  async findActiveByPraticaIds(praticaIds: string[]) {

    const data = await connectorFetch<{

      locks: Array<{ praticaId: string; userId: string; userName: string }>;

    }>(`/api/v1/tenants/${encodeURIComponent(this.tenantSlug)}/pratiche/locks/active`, {

      method: "POST",

      body: { praticaIds },

    });

    return data.locks;

  }

}



export function createConnectorLockRepository(scope: LockTenantScope): LockRepository {

  return new ConnectorLockRepository(scope.tenantSlug, scope);

}


