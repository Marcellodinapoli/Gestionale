export type ImpegnoAgendaFilter = {
  userId?: string;
  completato?: boolean;
  memoAtGte?: string;
  memoAtLte?: string;
  id?: string;
};

export type ImpegnoAgendaDto = {
  id: string;
  userId: string;
  titolo: string;
  nota: string | null;
  memoAt: string;
  completato: boolean;
  completatoAt: string | null;
  createdAt: string;
  userName?: string;
};

export interface ImpegniAgendaRepository {
  list(
    tenantSlug: string,
    tenantId: string,
    filter?: ImpegnoAgendaFilter,
    take?: number
  ): Promise<ImpegnoAgendaDto[]>;
  getById(tenantSlug: string, tenantId: string, id: string): Promise<ImpegnoAgendaDto | null>;
  create(
    tenantSlug: string,
    tenantId: string,
    data: { userId: string; titolo: string; nota?: string | null; memoAt: string | Date }
  ): Promise<ImpegnoAgendaDto>;
  complete(tenantSlug: string, tenantId: string, id: string, userId: string): Promise<void>;
  update(
    tenantSlug: string,
    tenantId: string,
    id: string,
    userId: string,
    data: { titolo?: string; nota?: string | null; memoAt?: string | Date }
  ): Promise<ImpegnoAgendaDto | null>;
  delete(tenantSlug: string, tenantId: string, id: string, userId: string): Promise<void>;
}
