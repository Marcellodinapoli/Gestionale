export type MessaggioInternoFilter = {
  toUserId?: string;
  fromUserId?: string;
  userId?: string;
  letto?: boolean;
  take?: number;
};

export type MessaggioInternoDto = {
  id: string;
  praticaId: string | null;
  fromUserId: string;
  toUserId: string;
  testo: string;
  letto: boolean;
  lettoAt: string | null;
  createdAt: string;
  fromUser?: { id: string; name: string };
  toUser?: { id: string; name: string };
  pratica?: {
    id: string;
    numero: string;
    debitore?: { nome: string; cognome: string };
  };
};

export interface MessaggiInterniRepository {
  list(
    tenantSlug: string,
    tenantId: string,
    filter?: MessaggioInternoFilter
  ): Promise<MessaggioInternoDto[]>;
  createMany(
    tenantSlug: string,
    tenantId: string,
    items: Array<{ fromUserId: string; toUserId: string; praticaId?: string | null; testo: string }>
  ): Promise<void>;
  getById(tenantSlug: string, tenantId: string, id: string): Promise<MessaggioInternoDto | null>;
  markLetto(tenantSlug: string, tenantId: string, id: string, letto: boolean): Promise<void>;
  updateTesto(tenantSlug: string, tenantId: string, id: string, testo: string): Promise<void>;
  delete(tenantSlug: string, tenantId: string, id: string): Promise<void>;
  deleteByPratica(tenantSlug: string, tenantId: string, praticaId: string): Promise<void>;
}
