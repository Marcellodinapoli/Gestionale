export type ConfigurazioneFilter = {
  tenantId?: string;
  chiave?: string;
  chiaviIn?: string[];
  chiaveStartsWith?: string;
  categoria?: string;
  chiaviOrStartsWith?: Array<{ startsWith?: string; in?: string[] }>;
};

export type ConfigurazioneDto = {
  id: string;
  tenantId: string;
  chiave: string;
  valore: string;
  categoria: string;
  updatedAt: string | Date;
};

export type ConfigurazioneUpsertInput = {
  tenantId: string;
  chiave: string;
  valore: string;
  categoria: string;
};

export interface ConfigurazioneRepository {
  list(
    tenantSlug: string,
    tenantId: string,
    filter?: ConfigurazioneFilter
  ): Promise<ConfigurazioneDto[]>;
  findByChiave(
    tenantSlug: string,
    tenantId: string,
    chiave: string,
    select?: Record<string, unknown>
  ): Promise<ConfigurazioneDto | null>;
  upsert(tenantSlug: string, data: ConfigurazioneUpsertInput): Promise<ConfigurazioneDto>;
  deleteMany(
    tenantSlug: string,
    tenantId: string,
    filter: ConfigurazioneFilter
  ): Promise<{ count: number }>;
}
