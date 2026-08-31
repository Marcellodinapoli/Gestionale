export type MessaggioAgendaFilter = {
  praticaId?: string;
  praticaScope?: "tenant";
  letto?: boolean;
  take?: number;
};

export type MessaggioAgendaDto = {
  id: string;
  praticaId: string;
  userId: string;
  memoAt: string;
  line: string;
  letto: boolean;
  lettoAt: string | null;
  createdAt: string;
  pratica?: {
    id: string;
    numero: string;
    debitore?: { nome: string; cognome: string };
  };
  user?: { id: string; name: string };
};

export interface MessaggiAgendaRepository {
  list(
    tenantSlug: string,
    tenantId: string,
    filter?: MessaggioAgendaFilter
  ): Promise<MessaggioAgendaDto[]>;
  findOpenByPratica(
    tenantSlug: string,
    tenantId: string,
    praticaId: string
  ): Promise<MessaggioAgendaDto | null>;
  upsertOpen(
    tenantSlug: string,
    tenantId: string,
    data: { praticaId: string; userId: string; memoAt: Date | string; line: string }
  ): Promise<void>;
  markLetto(tenantSlug: string, tenantId: string, id: string): Promise<void>;
  markPraticaLetti(tenantSlug: string, tenantId: string, praticaId: string): Promise<void>;
  deleteByPratica(tenantSlug: string, tenantId: string, praticaId: string): Promise<void>;
  getById(tenantSlug: string, tenantId: string, id: string): Promise<MessaggioAgendaDto | null>;
}
